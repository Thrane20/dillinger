import axios from "axios";

var service_interactor = {

    get_docker_status: async function () {
        // Call the backend - if error propogate the exception
        const response = await axios.get(
            "http://localhost:3060/diag/docker_status"
        );
        console.log(response.data);
        return response.data;

    }
}

export { service_interactor }