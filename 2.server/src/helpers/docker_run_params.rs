use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DockerRunParams {
    pub image_name: String,
    pub volumes: Option<Vec<String>>,
    pub ports: Option<Vec<String>>,
    pub env_vars: Option<Vec<String>>,
    pub cmd: Option<Vec<String>>,
    pub name: Option<String>,
    pub network: Option<String>,
    pub network_alias: Option<String>,
    pub network_mode: Option<String>,
    pub interactive: Option<bool>,
    pub tty: Option<bool>,
    pub remove: Option<bool>,
    pub hostname: Option<String>,
    pub domainname: Option<String>,
    pub user: Option<String>,
    pub working_dir: Option<String>,
    pub entrypoint: Option<String>,
    pub labels: Option<Vec<String>>,
}

impl DockerRunParams {
    pub fn new(image_name: String) -> DockerRunParams {
        DockerRunParams {
            image_name,
            volumes: None,
            ports: None,
            env_vars: None,
            cmd: None,
            name: None,
            network: None,
            network_alias: None,
            network_mode: None,
            interactive: None,
            tty: None,
            remove: None,
            hostname: None,
            domainname: None,
            user: None,
            working_dir: None,
            entrypoint: None,
            labels: None,
        }
    }

    pub fn volumes(mut self, volumes: Vec<String>) -> Self {
        self.volumes = Some(volumes);
        self
    }

    pub fn interactive(mut self, interactive: bool) -> Self {
        self.interactive = Some(interactive);
        self
    }

    pub fn tty(mut self, tty: bool) -> Self {
        self.tty = Some(tty);
        self
    }

    pub fn remove(mut self, remove: bool) -> Self {
        self.remove = Some(remove);
        self
    }

    // Add similar methods for other fields

    pub fn build(self) -> DockerRunParams {
        DockerRunParams {
            image_name: self.image_name,
            volumes: self.volumes,
            ports: self.ports,
            env_vars: self.env_vars,
            cmd: self.cmd,
            name: self.name,
            network: self.network,
            network_alias: self.network_alias,
            network_mode: self.network_mode,
            interactive: self.interactive,
            tty: self.tty,
            remove: self.remove,
            hostname: self.hostname,
            domainname: self.domainname,
            user: self.user,
            working_dir: self.working_dir,
            entrypoint: self.entrypoint,
            labels: self.labels,
        }
    }
}