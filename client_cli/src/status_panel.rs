use cursive::{
    view::{ Resizable, Nameable, Finder },
    views::{ Panel, NamedView, TextView, ResizedView },
};

use dillinger_lib::{ self };

trait StatusObserver {
    fn update_docker_status(&mut self, docker_status: &str);
}

struct StatusModel {
    docker_status: String,
    docker_status_observers: Vec<Box<dyn StatusObserver>>,
}

impl StatusModel {
    fn new() -> StatusModel {
        StatusModel {
            docker_status: "?".to_string(),
            docker_status_observers: Vec::new(),
        }
    }

    fn set_docker_status(&mut self, new_status: &str) {
        self.docker_status = new_status.to_string();
        self.notify_observers_docker_status_update();
    }

    fn get_docker_status(&self) -> String {
        self.docker_status.to_string()
    }

    fn add_observer(&mut self, observer: Box<dyn StatusObserver>) {
        self.docker_status_observers.push(observer);
    }

    fn notify_observers_docker_status_update(&mut self) {
        for observer in &mut self.docker_status_observers {
            observer.update_docker_status(&self.docker_status);
        }
    }
}

pub struct StatusView {
    panel: Option<cursive::views::ResizedView<Panel<NamedView<TextView>>>>,
}

impl StatusObserver for StatusView {
    fn update_docker_status(&mut self, docker_status: &str) {
        let mut panel = self.get_panel().expect("panel not found");
        if let Some(ref mut text_view) = panel.find_name::<TextView>("docker_status") {
            text_view.set_content(docker_status.to_string());
        }
    }
}

impl StatusView {
    pub fn new() -> StatusView {
        StatusView {
            panel: Some(
                Panel::new(TextView::new("??".to_string()).with_name("docker_status")).fixed_height(
                    3
                )
            ),
        }
    }

    pub fn get_panel(&mut self) -> Option<ResizedView<Panel<NamedView<TextView>>>> {
        self.panel.take()
    }
}

pub struct StatusController {
    model: StatusModel,
    view: Box<StatusView>
}

impl StatusController {
    pub fn new() -> StatusController {
        let mut model = StatusModel::new();
        let view = Box::new(StatusView::new());
        //model.add_observer(view);
        StatusController {
            model: model,
            view: view,
        }
    }

    pub async fn probe_docker_status(&mut self) {
        let docker_status: bool = dillinger_lib::docker::ping().await;
        self.set_docker_status(if docker_status {"UP"} else {"DOWN"});
    }

    fn set_docker_status(&mut self, new_status: &str) {
        self.model.set_docker_status(new_status);
    }
}

// pub struct StatusPanel {
//     panel: Option<cursive::views::ResizedView<Panel<NamedView<TextView>>>>,
//     docker_status: String,
// }

// impl StatusPanel {
//     pub fn new() -> StatusPanel {
//         StatusPanel {
//             panel: Some(
//                 Panel::new(TextView::new("?".to_string()).with_name("docker_status")).fixed_height(
//                     3
//                 )
//             ),
//             docker_status: "?".to_string(),
//         }
//     }

//     pub fn get_panel(&mut self) -> Option<ResizedView<Panel<NamedView<TextView>>>> {
//         self.panel.take()
//     }

//     // get_docker_status
//     pub fn get_docker_status(&self) -> String {
//         self.docker_status.to_string()
//     }

//     pub async fn probe_docker_status(&mut self) {
//         let docker_status: bool = dillinger_lib::docker::ping().await;
//         let mut ds = self.docker_status.clone();
//         if docker_status {
//             ds = "UP".to_string();
//         } else {
//             ds = "DOWN".to_string();
//         }

//         self.docker_status = ds;
//     }

//     pub fn update_docker_status(&mut self, cursive: &mut Cursive, new_status: &str) {
//         // Find the named TextView in the Cursive view tree
//         if let Some(mut text_view) = cursive.find_name::<TextView>("docker_status") {
//             // Update the text of the TextView
//             text_view.set_content(new_status.to_string());
//         }
//     }
// }
