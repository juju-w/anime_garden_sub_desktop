use serde::{Deserialize, Serialize};
use tauri::{State};
use chrono::Utc;
use sqlx::{Row};
use rss::Channel;
use reqwest::Client;
use std::time::Duration;
use uuid::Uuid;
use crate::DbState;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Filter {
    pub keyword: String,
    #[serde(default = "default_filter_type")]
    pub filter_type: String,
}

fn default_filter_type() -> String { "include".to_string() }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subscription {
    pub id: Option<i64>,
    pub name: String,
    pub url: String,
    #[serde(default = "default_true")]
    pub is_active: bool,
    #[serde(default)]
    pub download_history: bool,
    #[serde(default)]
    pub last_checked_at: Option<String>,
    #[serde(default)]
    pub filters: Vec<Filter>,
}

fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryItem {
    pub id: Option<i64>,
    pub title: String,
    pub magnet_link: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub aria2_rpc_url: String,
    pub aria2_rpc_secret: String,
    pub download_path: String,
    pub max_threads: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadTask {
    pub gid: String,
    pub name: String,
    pub status: String,
    pub total_length: String,
    pub completed_length: String,
    pub download_speed: String,
}

// --- Aria2 Helpers ---

async fn aria2_rpc_call(method: &str, params: Vec<serde_json::Value>, pool: &sqlx::SqlitePool) -> Result<serde_json::Value, String> {
    let settings = get_settings_internal(pool).await;
    let client = Client::new();
    let mut final_params = params;
    if !settings.aria2_rpc_secret.is_empty() {
        final_params.insert(0, serde_json::json!(format!("token:{}", settings.aria2_rpc_secret)));
    }

    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": Uuid::new_v4().to_string(),
        "method": method,
        "params": final_params
    });

    let res = client.post(&settings.aria2_rpc_url).json(&payload).send().await
        .map_err(|e| e.to_string())?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(error) = json.get("error") {
        return Err(error["message"].as_str().unwrap_or("Unknown RPC error").to_string());
    }
    Ok(json.get("result").cloned().unwrap_or_default())
}

// --- Background Logic ---

async fn submit_to_aria2(rpc_url: &str, secret: &str, magnet: &str) -> bool {
    let client = Client::new();
    let id = Uuid::new_v4().to_string();
    let mut params = vec![serde_json::json!([magnet])];
    if !secret.is_empty() {
        params.insert(0, serde_json::json!(format!("token:{}", secret)));
    }

    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": "aria2.addUri",
        "params": params
    });

    match client.post(rpc_url).json(&payload).send().await {
        Ok(res) => {
            let json: serde_json::Value = res.json().await.unwrap_or_default();
            json.get("result").is_some()
        }
        Err(_) => false,
    }
}

pub async fn check_feeds(pool: &sqlx::SqlitePool) {
    let client = match Client::builder().timeout(Duration::from_secs(30)).build() {
        Ok(c) => c,
        Err(_) => return,
    };
    
    let subs = match sqlx::query("SELECT id, name, url, is_active, download_history, last_checked_at FROM subscriptions WHERE is_active = 1")
        .fetch_all(pool).await {
            Ok(rows) => rows,
            Err(_) => return,
        };

    let settings = get_settings_internal(pool).await;

    for row in subs {
        let sub_id: i64 = row.get(0);
        let url: String = row.get(2);
        let download_history: bool = row.get::<i32, _>(4) != 0;
        let last_checked: Option<String> = row.get(5);
        let is_first_run = last_checked.is_none();

        let filters: Vec<String> = sqlx::query("SELECT keyword FROM filters WHERE subscription_id = ? AND type = 'include'")
            .bind(sub_id).fetch_all(pool).await.unwrap_or_default().into_iter().map(|r| r.get(0)).collect();

        if let Ok(res) = client.get(&url).send().await {
            if let Ok(bytes) = res.bytes().await {
                if let Ok(channel) = Channel::read_from(&bytes[..]) {
                    for item in channel.items() {
                        let title = item.title().unwrap_or("Unknown");
                        let magnet = item.link().filter(|l| l.starts_with("magnet:")).or_else(|| {
                            item.enclosure().filter(|e| e.url().starts_with("magnet:")).map(|e| e.url())
                        }).unwrap_or("");

                        if magnet.is_empty() { continue; }

                        let exists = sqlx::query("SELECT id FROM download_history WHERE magnet_link = ?")
                            .bind(magnet).fetch_optional(pool).await.unwrap_or_default().is_some();
                        if exists { continue; }

                        let matched = if filters.is_empty() { true } else {
                            filters.iter().any(|f| title.to_lowercase().contains(&f.to_lowercase()))
                        };

                        if matched {
                            let mut status = "skipped".to_string();
                            if download_history || !is_first_run {
                                if submit_to_aria2(&settings.aria2_rpc_url, &settings.aria2_rpc_secret, magnet).await {
                                    status = "submitted".to_string();
                                } else {
                                    status = "failed".to_string();
                                }
                            }
                            let now = Utc::now().to_rfc3339();
                            let _ = sqlx::query("INSERT INTO download_history (subscription_id, title, magnet_link, status, created_at) VALUES (?, ?, ?, ?, ?)")
                                .bind(sub_id).bind(title).bind(magnet).bind(status).bind(now).execute(pool).await;
                        }
                    }
                }
            }
        }
        let _ = sqlx::query("UPDATE subscriptions SET last_checked_at = ? WHERE id = ?")
            .bind(Utc::now().to_rfc3339()).bind(sub_id).execute(pool).await;
    }
}

async fn get_settings_internal(pool: &sqlx::SqlitePool) -> AppSettings {
    let rows = sqlx::query("SELECT key, value FROM settings").fetch_all(pool).await.unwrap_or_default();
    let find = |k: &str, default: &str| rows.iter().find(|r| r.get::<String, _>(0) == k).map(|r| r.get::<String, _>(1)).unwrap_or_else(|| default.to_string());
    
    AppSettings {
        aria2_rpc_url: find("aria2_rpc_url", "http://localhost:6800/jsonrpc"),
        aria2_rpc_secret: find("aria2_rpc_secret", ""),
        download_path: find("download_path", ""),
        max_threads: find("max_threads", "5"),
    }
}

// --- Commands ---

#[tauri::command]
pub async fn get_subscriptions(state: State<'_, DbState>) -> Result<Vec<Subscription>, String> {
    let rows = sqlx::query("SELECT id, name, url, is_active, download_history, last_checked_at FROM subscriptions")
        .fetch_all(&state.pool).await.map_err(|e| e.to_string())?;
    let mut subs = Vec::new();
    for row in rows {
        let id: i64 = row.get(0);
        let filters = sqlx::query("SELECT keyword, type FROM filters WHERE subscription_id = ?").bind(id).fetch_all(&state.pool).await.map_err(|e| e.to_string())?.into_iter().map(|f| Filter { keyword: f.get(0), filter_type: f.get(1) }).collect();
        subs.push(Subscription { id: Some(id), name: row.get(1), url: row.get(2), is_active: row.get::<i32, _>(3) != 0, download_history: row.get::<i32, _>(4) != 0, last_checked_at: row.get(5), filters });
    }
    Ok(subs)
}

#[tauri::command]
pub async fn upsert_subscription(state: State<'_, DbState>, sub: Subscription) -> Result<(), String> {
    if let Some(id) = sub.id {
        sqlx::query("UPDATE subscriptions SET name = ?, url = ?, download_history = ? WHERE id = ?").bind(&sub.name).bind(&sub.url).bind(sub.download_history as i32).bind(id).execute(&state.pool).await.map_err(|e| e.to_string())?;
        sqlx::query("DELETE FROM filters WHERE subscription_id = ?").bind(id).execute(&state.pool).await.map_err(|e| e.to_string())?;
        for filter in sub.filters { sqlx::query("INSERT INTO filters (subscription_id, keyword, type) VALUES (?, ?, ?)").bind(id).bind(filter.keyword).bind(filter.filter_type).execute(&state.pool).await.map_err(|e| e.to_string())?; }
    } else {
        let res = sqlx::query("INSERT INTO subscriptions (name, url, is_active, download_history) VALUES (?, ?, 1, ?)").bind(&sub.name).bind(&sub.url).bind(sub.download_history as i32).execute(&state.pool).await.map_err(|e| e.to_string())?;
        let id = res.last_insert_rowid();
        for filter in sub.filters { sqlx::query("INSERT INTO filters (subscription_id, keyword, type) VALUES (?, ?, ?)").bind(id).bind(filter.keyword).bind(filter.filter_type).execute(&state.pool).await.map_err(|e| e.to_string())?; }
    }
    let pool = state.pool.clone();
    tokio::spawn(async move { check_feeds(&pool).await; });
    Ok(())
}

#[tauri::command]
pub async fn toggle_subscription(state: State<'_, DbState>, id: i64, active: bool) -> Result<(), String> {
    sqlx::query("UPDATE subscriptions SET is_active = ? WHERE id = ?").bind(active as i32).bind(id).execute(&state.pool).await.map_err(|e| e.to_string())?;
    if active { let pool = state.pool.clone(); tokio::spawn(async move { check_feeds(&pool).await; }); }
    Ok(())
}

#[tauri::command]
pub async fn delete_subscription(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM subscriptions WHERE id = ?").bind(id).execute(&state.pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM filters WHERE subscription_id = ?").bind(id).execute(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_history(state: State<'_, DbState>) -> Result<Vec<HistoryItem>, String> {
    let rows = sqlx::query("SELECT id, title, magnet_link, status, created_at FROM download_history ORDER BY created_at DESC").fetch_all(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| HistoryItem { id: Some(r.get(0)), title: r.get(1), magnet_link: r.get(2), status: r.get(3), created_at: r.get(4) }).collect())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, DbState>) -> Result<(), String> {
    sqlx::query("DELETE FROM download_history").execute(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, DbState>) -> Result<AppSettings, String> {
    Ok(get_settings_internal(&state.pool).await)
}

#[tauri::command]
pub async fn save_settings(state: State<'_, DbState>, settings: AppSettings) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('aria2_rpc_url', ?), ('aria2_rpc_secret', ?), ('download_path', ?), ('max_threads', ?)")
        .bind(settings.aria2_rpc_url).bind(settings.aria2_rpc_secret).bind(settings.download_path).bind(settings.max_threads)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_tasks(state: State<'_, DbState>) -> Result<Vec<DownloadTask>, String> {
    let res = aria2_rpc_call("aria2.tellAll", vec![], &state.pool).await?;
    let tasks: Vec<DownloadTask> = res.as_array().unwrap_or(&vec![]).iter().map(|t| {
        let name = t["bittorrent"]["info"]["name"].as_str()
            .or_else(|| t["files"][0]["path"].as_str())
            .unwrap_or("Unknown Task").to_string();
            
        DownloadTask {
            gid: t["gid"].as_str().unwrap_or_default().to_string(),
            name,
            status: t["status"].as_str().unwrap_or_default().to_string(),
            total_length: t["totalLength"].as_str().unwrap_or("0").to_string(),
            completed_length: t["completedLength"].as_str().unwrap_or("0").to_string(),
            download_speed: t["downloadSpeed"].as_str().unwrap_or("0").to_string(),
        }
    }).collect();
    Ok(tasks)
}

#[tauri::command]
pub async fn pause_task(state: State<'_, DbState>, gid: String) -> Result<(), String> {
    aria2_rpc_call("aria2.pause", vec![serde_json::json!(gid)], &state.pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn resume_task(state: State<'_, DbState>, gid: String) -> Result<(), String> {
    aria2_rpc_call("aria2.unpause", vec![serde_json::json!(gid)], &state.pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_task(state: State<'_, DbState>, gid: String) -> Result<(), String> {
    let _ = aria2_rpc_call("aria2.forceRemove", vec![serde_json::json!(gid)], &state.pool).await;
    let _ = aria2_rpc_call("aria2.removeDownloadResult", vec![serde_json::json!(gid)], &state.pool).await;
    Ok(())
}

// --- Unit Tests ---
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subscription_deserialization_minimal() {
        let json = r#"{
            "name": "Test Anime",
            "url": "https://example.com/rss"
        }"#;
        let sub: Subscription = serde_json::from_str(json).unwrap();
        assert_eq!(sub.name, "Test Anime");
        assert_eq!(sub.is_active, true); // Default value
        assert_eq!(sub.download_history, false); // Default value
    }

    #[test]
    fn test_filter_deserialization() {
        let json = r#"{"keyword": "1080P"}"#;
        let filter: Filter = serde_json::from_str(json).unwrap();
        assert_eq!(filter.keyword, "1080P");
        assert_eq!(filter.filter_type, "include");
    }
}
