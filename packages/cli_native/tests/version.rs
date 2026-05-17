use dillinger_gaming::utils::version::{compare_versions, fetch_remote_versions_from};
use wiremock::{matchers::method, Mock, MockServer, ResponseTemplate};

#[test]
fn compare_versions_ordering() {
    assert!(compare_versions("1.0.0", "1.0.1") < 0, "older < newer");
    assert!(compare_versions("1.0.1", "1.0.0") > 0, "newer > older");
    assert!(compare_versions("1.0.0", "1.0.0") == 0, "equal == 0");
    assert!(compare_versions("2.0.0", "1.9.9") > 0, "major bump");
    assert!(compare_versions("1.10.0", "1.9.9") > 0, "minor bump");
}

#[test]
fn compare_with_v_prefix() {
    assert_eq!(compare_versions("v1.0.0", "v1.0.0"), 0);
    assert!(compare_versions("v1.0.0", "v1.0.1") < 0);
}

#[tokio::test]
async fn fetch_remote_versions_parses_valid_response() {
    let server = MockServer::start().await;

    let body = "DILLINGER_CORE_VERSION=1.2.3\nDILLINGER_START_SCRIPT_VERSION=0.9.1\n";
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_string(body))
        .mount(&server)
        .await;

    let result = fetch_remote_versions_from(&server.uri()).await;
    let versions = result.expect("should return Some");
    assert_eq!(versions.core_version, "1.2.3");
    assert_eq!(versions.script_version, "0.9.1");
}

#[tokio::test]
async fn fetch_remote_versions_returns_none_on_error() {
    let server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    let result = fetch_remote_versions_from(&server.uri()).await;
    assert!(result.is_none());
}
