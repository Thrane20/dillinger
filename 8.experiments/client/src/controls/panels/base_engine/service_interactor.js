import axios from "axios";

var service_interactor = {


    get_docker_status: async function () {

        // Call the backend - if error propogate the exception
        const response = await axios.get(
            `http://192.168.68.200:${import.meta.env.VITE_SERVER_PORT}/diag/docker_status`
        );
        console.log(response.data);
        return response.data;

    }
}

export { service_interactor }