use warp::Filter;
use warp::ws::{Message, WebSocket};
use tokio::sync::{mpsc, RwLock};
use futures::{FutureExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
struct Payload {
    id: String,
    message: String,
}

pub type Clients = Arc<RwLock<HashMap<String, mpsc::UnboundedSender<Result<Message, warp::Error>>>>>;

lazy_static! {
    pub static ref clients: Clients = Arc::new(RwLock::new(HashMap::new()));
    pub static ref clients_filter: warp::filters::BoxedFilter<(Clients,)> = warp::any().map(move || clients.clone()).boxed();
}


pub async fn client_connection(ws: WebSocket) {
    let (tx, mut rx) = ws.split();
    let (client_tx, client_rx) = mpsc::unbounded_channel();
    let client_rx = tokio_stream::wrappers::UnboundedReceiverStream::new(client_rx);

    let client_id = Uuid::new_v4().to_string();
    clients.write().await.insert(client_id.clone(), client_tx);

    tokio::task::spawn(client_rx.forward(tx).map(|result| {
        if let Err(e) = result {
            eprintln!("websocket send error: {}", e);
        }
    }));

    while let Some(result) = rx.next().await {
        match result {
            Ok(msg) => {
                if msg.is_text() {
                    let payload: Payload = serde_json::from_str(msg.to_str().unwrap()).unwrap();
                    println!("Received message from {}: {}", client_id, payload.message);
                }
            }
            Err(e) => {
                eprintln!("websocket error: {}", e);
                break;
            }
        }
    }

    clients.write().await.remove(&client_id);
    println!("{} disconnected", client_id);
}

pub async fn send_message(message: String) {
    let attached_clients = clients.read().await;
    for (_, tx) in attached_clients.iter() {
        let _ = tx.send(Ok(Message::text(message.clone())));
    }
}
