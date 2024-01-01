use reqwest::blocking::Client;
use scraper::{Html, Selector};

pub const PSX_URLS: &str = "https://archive.org/download/redump.psx";

pub fn find_download_links(url: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    
    println!("Running download link parser");
    
    // Create a new HTTP client
    let client = Client::new();

    // Send an HTTP GET request to the URL and get the response body
    println!("Fetching... please wait...");
    let response = client.get(url).send()?;
    let body = response.text()?;

    println!("Got the links OK.");
    // Parse the HTML document using the scraper crate
    let document = Html::parse_document(&body);

    // Find all <a> elements with a "href" attribute that ends with ".zip"
    let selector = Selector::parse(r#"a[href$=".zip"]"#).unwrap();
    let links: Vec<String> = document
        .select(&selector)
        .map(|element| format!("{}/{}", url, element.value().attr("href").unwrap().to_string()))
        .collect();

    for link in &links {
        println!("{}", link);
    }

    Ok(links)
}