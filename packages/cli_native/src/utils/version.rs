use anyhow::{Context, Result};
use semver::Version;
use std::process::Stdio;
use tokio::process::Command;

use crate::utils::constants::VERSIONING_URL;

#[derive(Debug, Clone)]
pub struct RemoteVersions {
    pub core_version: String,
    pub script_version: String,
}

/// Fetches versioning.env from the given URL (or the default remote URL).
pub async fn fetch_remote_versions_from(url: &str) -> Option<RemoteVersions> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .ok()?;
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let text = response.text().await.ok()?;
    parse_versioning_env(&text)
}

pub async fn fetch_remote_versions() -> Option<RemoteVersions> {
    fetch_remote_versions_from(VERSIONING_URL).await
}

fn parse_versioning_env(content: &str) -> Option<RemoteVersions> {
    let core_version = content
        .lines()
        .find(|l| l.starts_with("DILLINGER_CORE_VERSION="))?
        .split('=')
        .nth(1)?
        .trim()
        .trim_start_matches('v')
        .to_string();

    let script_version = content
        .lines()
        .find(|l| l.starts_with("DILLINGER_START_SCRIPT_VERSION="))?
        .split('=')
        .nth(1)?
        .trim()
        .trim_start_matches('v')
        .to_string();

    if core_version.is_empty() || script_version.is_empty() {
        return None;
    }

    Some(RemoteVersions { core_version, script_version })
}

/// Compares two version strings. Returns negative, zero, or positive like a comparator.
pub fn compare_versions(current: &str, next: &str) -> i32 {
    let cur = Version::parse(&semver_coerce(current)).unwrap_or(Version::new(0, 0, 0));
    let nxt = Version::parse(&semver_coerce(next)).unwrap_or(Version::new(0, 0, 0));
    match cur.cmp(&nxt) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    }
}

/// Coerces a loose version string (e.g. "v1.2" or "1.2") to a three-part semver.
fn semver_coerce(s: &str) -> String {
    let s = s.trim().trim_start_matches('v');
    let parts: Vec<&str> = s.split('.').collect();
    match parts.len() {
        0 => "0.0.0".to_string(),
        1 => format!("{}.0.0", parts[0]),
        2 => format!("{}.{}.0", parts[0], parts[1]),
        _ => format!("{}.{}.{}", parts[0], parts[1], parts[2]),
    }
}

/// Returns the highest locally available semver tag for the given image name.
pub async fn get_local_image_version(image_name: &str) -> Result<Option<String>> {
    let output = Command::new("docker")
        .args([
            "images",
            "--format",
            "{{.Repository}}:{{.Tag}}",
            image_name,
        ])
        .stdout(Stdio::piped())
        .output()
        .await
        .context("docker images failed")?;

    let mut versions: Vec<Version> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let tag = line.split(':').nth(1)?.trim().trim_start_matches('v');
            Version::parse(&semver_coerce(tag)).ok()
        })
        .collect();

    if versions.is_empty() {
        return Ok(None);
    }

    versions.sort();
    versions.reverse();
    Ok(Some(versions[0].to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_returns_negative_when_lower() {
        assert!(compare_versions("0.3.0", "0.3.1") < 0);
    }

    #[test]
    fn compare_returns_positive_when_higher() {
        assert!(compare_versions("0.3.2", "0.3.1") > 0);
    }

    #[test]
    fn compare_returns_zero_when_equal() {
        assert_eq!(compare_versions("0.3.1", "0.3.1"), 0);
    }

    #[test]
    fn parse_versioning_env_extracts_both_keys() {
        let content =
            "DILLINGER_CORE_VERSION=0.3.1\nDILLINGER_START_SCRIPT_VERSION=0.3.0\n";
        let result = parse_versioning_env(content).unwrap();
        assert_eq!(result.core_version, "0.3.1");
        assert_eq!(result.script_version, "0.3.0");
    }

    #[test]
    fn parse_versioning_env_strips_v_prefix() {
        let content =
            "DILLINGER_CORE_VERSION=v0.3.1\nDILLINGER_START_SCRIPT_VERSION=v0.3.0\n";
        let result = parse_versioning_env(content).unwrap();
        assert_eq!(result.core_version, "0.3.1");
    }
}
