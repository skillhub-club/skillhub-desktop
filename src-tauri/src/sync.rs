use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncFile {
    pub filepath: String,
    pub content: String,
    pub content_hash: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    pub skill_id: String,
    pub skill_slug: String,
    pub version: u32,
    pub synced_at: String,
    pub platform_url: String,
}

const SKIP_FILES: &[&str] = &[
    ".git",
    ".DS_Store",
    ".skillhub.json",
    ".gitignore",
    "Thumbs.db",
];

fn should_skip(name: &str) -> bool {
    name.starts_with('.') && SKIP_FILES.contains(&name) || name == "Thumbs.db"
}

/// Recursively collect all files from a skill directory, compute SHA-256 hashes.
pub async fn collect_files(path: &str) -> Result<Vec<SyncFile>, String> {
    let root = Path::new(path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut files = Vec::new();
    collect_files_recursive(root, root, &mut files).await?;
    Ok(files)
}

#[async_recursion::async_recursion]
async fn collect_files_recursive(
    root: &Path,
    current: &Path,
    files: &mut Vec<SyncFile>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(current)
        .await
        .map_err(|e| format!("Failed to read directory {}: {}", current.display(), e))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }

        let entry_path = entry.path();
        let file_type = entry
            .file_type()
            .await
            .map_err(|e| format!("Failed to get file type: {}", e))?;

        if file_type.is_dir() {
            collect_files_recursive(root, &entry_path, files).await?;
        } else if file_type.is_file() {
            let content = fs::read(&entry_path)
                .await
                .map_err(|e| format!("Failed to read file {}: {}", entry_path.display(), e))?;

            let file_size = content.len() as u64;

            // Compute SHA-256 hash
            let mut hasher = Sha256::new();
            hasher.update(&content);
            let hash = hex::encode(hasher.finalize());

            // Get relative path from root
            let relative = entry_path
                .strip_prefix(root)
                .map_err(|e| format!("Failed to compute relative path: {}", e))?;
            let filepath = relative.to_string_lossy().to_string();

            // Convert content to string (skip binary files)
            let content_str = match String::from_utf8(content) {
                Ok(s) => s,
                Err(_) => {
                    // Skip binary files
                    continue;
                }
            };

            files.push(SyncFile {
                filepath,
                content: content_str,
                content_hash: hash,
                file_size,
            });
        }
    }

    Ok(())
}

/// Write pulled files to local directory, creating parent dirs as needed.
/// Removes files that exist locally but not in the incoming set.
pub async fn write_files(path: &str, files: &[SyncFile]) -> Result<(), String> {
    let root = Path::new(path);

    // Create root directory if it doesn't exist
    fs::create_dir_all(root)
        .await
        .map_err(|e| format!("Failed to create directory {}: {}", path, e))?;

    // Collect incoming filepaths for cleanup
    let incoming_paths: std::collections::HashSet<String> =
        files.iter().map(|f| f.filepath.clone()).collect();

    // Write all incoming files
    for file in files {
        let file_path = root.join(&file.filepath);

        // Create parent directories
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        fs::write(&file_path, &file.content)
            .await
            .map_err(|e| format!("Failed to write file {}: {}", file_path.display(), e))?;
    }

    // Clean removed files: collect existing files and remove those not in incoming set
    let mut existing_files = Vec::new();
    collect_existing_files(root, root, &mut existing_files).await?;

    for existing in existing_files {
        if !incoming_paths.contains(&existing) {
            let full_path = root.join(&existing);
            let _ = fs::remove_file(&full_path).await;
        }
    }

    Ok(())
}

#[async_recursion::async_recursion]
async fn collect_existing_files(
    root: &Path,
    current: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    let mut entries = match fs::read_dir(current).await {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }

        let entry_path = entry.path();
        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;

        if file_type.is_dir() {
            collect_existing_files(root, &entry_path, files).await?;
        } else if file_type.is_file() {
            if let Ok(relative) = entry_path.strip_prefix(root) {
                files.push(relative.to_string_lossy().to_string());
            }
        }
    }

    Ok(())
}

/// Read .skillhub.json metadata from skill directory.
pub async fn read_meta(path: &str) -> Result<Option<SyncMeta>, String> {
    let meta_path = Path::new(path).join(".skillhub.json");
    if !meta_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&meta_path)
        .await
        .map_err(|e| format!("Failed to read sync metadata: {}", e))?;

    let meta: SyncMeta =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse sync metadata: {}", e))?;

    Ok(Some(meta))
}

/// Write .skillhub.json metadata file.
pub async fn write_meta(path: &str, meta: &SyncMeta) -> Result<(), String> {
    let meta_path = Path::new(path).join(".skillhub.json");

    let content = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("Failed to serialize sync metadata: {}", e))?;

    fs::write(&meta_path, content)
        .await
        .map_err(|e| format!("Failed to write sync metadata: {}", e))?;

    Ok(())
}

/// Save binary data (e.g. Git ZIP export) to disk.
pub async fn save_export(data: &[u8], save_path: &str) -> Result<(), String> {
    let path = Path::new(save_path);

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(path, data)
        .await
        .map_err(|e| format!("Failed to save export file: {}", e))?;

    Ok(())
}
