mod commands;

use tauri::{Manager};
use sqlx::{sqlite::SqlitePool};
use std::time::Duration;
use crate::commands::*;
use tauri_plugin_shell::ShellExt;

// Define the state here so it's consistent
pub struct DbState {
    pub pool: SqlitePool,
}

pub async fn init_db(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY, name TEXT, url TEXT UNIQUE, is_active INTEGER, download_history INTEGER, last_checked_at TEXT)").execute(pool).await.map_err(|e| e.to_string())?;
    sqlx::query("CREATE TABLE IF NOT EXISTS filters (id INTEGER PRIMARY KEY, subscription_id INTEGER, keyword TEXT, type TEXT)").execute(pool).await.map_err(|e| e.to_string())?;
    sqlx::query("CREATE TABLE IF NOT EXISTS download_history (id INTEGER PRIMARY KEY, subscription_id INTEGER, title TEXT, magnet_link TEXT, status TEXT, created_at TEXT)").execute(pool).await.map_err(|e| e.to_string())?;
    sqlx::query("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Start Aria2 Sidecar (ignore failure)
            if let Ok(sidecar) = app.shell().sidecar("aria2c") {
                let _ = sidecar.args(["--enable-rpc", "--rpc-listen-all", "--rpc-allow-origin-all", "--quiet"]).spawn();
            }

            // Sync initialization
            let pool = tauri::async_runtime::block_on(async move {
                let data_dir = handle.path().app_data_dir().expect("Failed to get app data dir");
                std::fs::create_dir_all(&data_dir).expect("Failed to create app data dir");
                let db_path = data_dir.join("anime_garden.db");
                let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
                let pool = SqlitePool::connect(&db_url).await.expect("Failed to connect to database");
                init_db(&pool).await.expect("Failed to initialize database");
                pool
            });

            // CRITICAL: Manage state with the pool
            app.manage(DbState { pool: pool.clone() });

            // Background sync task
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(600));
                loop {
                    interval.tick().await;
                    check_feeds(&pool).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_subscriptions, upsert_subscription, toggle_subscription, delete_subscription,
            get_history, clear_history, get_settings, save_settings,
            get_tasks, pause_task, resume_task, remove_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
