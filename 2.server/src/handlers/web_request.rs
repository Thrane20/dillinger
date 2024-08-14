use log::info;
use reqwest;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, USER_AGENT};
use std::collections::HashMap;
use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub struct WebError {
    pub status: u16,
    pub description: String,
}

impl fmt::Display for WebError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Status: {}, Description: {}",
            self.status, self.description
        )
    }
}

impl Error for WebError {}

impl From<reqwest::Error> for WebError {
    fn from(err: reqwest::Error) -> Self {
        let status = if let Some(status) = err.status() {
            status.as_u16()
        } else {
            500 // Default to 500 if no status is available
        };
        let description = err.to_string();
        WebError {
            status,
            description,
        }
    }
}

pub async fn post(
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<serde_json::Value, WebError> {
    // Create a new reqwest client (non-blocking)
    let client = reqwest::Client::new();
    let req_body = body.unwrap_or("".to_string());
    info!("req_body: {:?}", req_body);

    // Setup standard headers for the request
    let mut reqHeaders = HeaderMap::new();
    reqHeaders.insert(ACCEPT, HeaderValue::from_static("application/json"));
    reqHeaders.insert(USER_AGENT, HeaderValue::from_static("reqwest"));


    // Process any additional headers passed in
    if let Some(headers) = headers {
        for (key, value) in headers.iter() {
            reqHeaders.insert(
                HeaderName::from_bytes(key.as_bytes()).unwrap(),
                HeaderValue::from_str(value).unwrap(),
            );
        }
    }

    // Post the request to the given URL
    let res = client
        .post(&url)
        .headers(reqHeaders)
        .body(req_body)
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    // Return the response (or a WebError if there was an error)
    Ok(res)
}
