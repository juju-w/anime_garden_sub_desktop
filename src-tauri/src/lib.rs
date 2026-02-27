mod commands;

use tauri::{Manager};
use sqlx::{sqlite::SqlitePool, sqlite::SqliteConnectOptions, Row};
use std::time::Duration;
use crate::commands::*;
use tauri_plugin_shell::ShellExt;

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
            
            // 1. Initialize Database first
            let pool = tauri::async_runtime::block_on(async move {
                let data_dir = handle.path().app_data_dir().expect("Failed to get app data dir");
                std::fs::create_dir_all(&data_dir).expect("Failed to create app data dir");
                let db_path = data_dir.join("anime_garden.db");
                let options = SqliteConnectOptions::new().filename(db_path).create_if_missing(true);
                let pool = SqlitePool::connect_with(options).await.expect("Failed to connect to database");
                init_db(&pool).await.expect("Failed to initialize database");
                pool
            });

            // 2. Fetch Secret from Settings
            let rpc_secret = tauri::async_runtime::block_on(async {
                sqlx::query("SELECT value FROM settings WHERE key = 'aria2_rpc_secret'")
                    .fetch_optional(&pool).await.ok().flatten().map(|r| r.get::<String, _>(0)).unwrap_or_default()
            });

            // 3. Start Aria2 Sidecar with the correct Secret
            if let Ok(sidecar) = app.shell().sidecar("aria2c") {
                let mut args = vec![
                    "--enable-rpc".to_string(),
                    "--rpc-listen-all=true".to_string(),
                    "--rpc-allow-origin-all=true".to_string(),
                    "--quiet=true".to_string()
                ];
                
                // If secret exists, pass it to the binary
                if !rpc_secret.is_empty() {
                    args.push(format!("--rpc-secret={}", rpc_secret));
                }

                match sidecar.args(args).spawn() {
                    Ok(_) => println!("Aria2 sidecar started with secret: {}", !rpc_secret.is_empty()),
                    Err(e) => eprintln!("Failed to spawn aria2c: {}", e),
                }
            }

            app.manage(DbState { pool: pool.clone() });

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
