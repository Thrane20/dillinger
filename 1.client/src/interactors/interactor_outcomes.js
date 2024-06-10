export const outcomes = {
    nop: {
        title: "",
        what: "",
        fixes: [],
        icon: ""
    },
    dillinger_unreachable: {
        title: "Dillinger Unreachable",
        tooltip: "The Dillinger service is not reachable. There could be a lot of reasons for this, so click this icon to find solutions.",
        what: "The Dillinger service is not reachable. The 'service' is the backend rust/warp server that provides the API for the Dillinger UI (what you're looking at now), and all the underlying launch and run functions. This is the most fundamental component - it needs to be up and running for anything to work.",
        fixes: [
            "Restart the Dillinger service"
        ],
        icon: "critical"
    },
    docker_up: {
        title: "Docker Up",
        tooltip: "The Docker service is running. All is well.",
        what: "The Docker service is running. All is well.",
        fixes: [],
        icon: "ok"
    },
    docker_down: {
        title: "Docker Down",
        what: "The Docker service is not running.",
        fixes: [
            "Start the Docker service and hit refresh."
        ],
        icon: "critical"
    }
}