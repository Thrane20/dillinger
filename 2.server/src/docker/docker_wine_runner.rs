use crate::{config, handlers::docker_interactor::DockerError, helpers::docker_run_params::DockerRunParams};



pub async fn build_run_params() -> Result<DockerRunParams, DockerError> {

    let t = config::WINE_RUNNER_NAME;
    // Create an empty DockerRunParams object
    let mut run_params = DockerRunParams::new(config::WINE_RUNNER_NAME.to_string());

    // run_params.
    Ok(run_params)
}