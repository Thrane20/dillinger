use lazy_static::lazy_static;

struct DillingerState {
    docker_up: bool,
}

lazy_static! {
    static ref STATE: DillingerState = DillingerState {
        docker_up = false
    };
}