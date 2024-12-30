import axios from "axios";

var service_interactor = {

    get_volumes: async function () {
        // Call the backend - if error propogate the exception
        const response = await axios.get(
            "http://dillingerserver:3060/sys/volumes"
        );
        console.log(response.data);
        return response.data;

    },

    list_directory_contents: async function (path) {
        // Call the backend - if error propogate the exception
        let encoded_path = encodeURIComponent(path);
        const response = await axios.get(
            `http://dillingerserver:3060/sys/ls/${encoded_path}`
        );
        console.log(response.data);
        return response.data;
    },

    // TODO: I might can this - not seeing the current need
    list_volume_contents: async function (volume, path) {
        // Call the backend - if error propogate the exception
        // Note: the path is the path inside the volume - so needs to be encoded
        let encoded_path = encodeURIComponent(path);
        const response = await axios.get(
            `http://dillingerserver:3060/sys/volumes/${volume}/contents/${encoded_path}`
        );
        console.log(response.data);
        return response.data;
    }


}

export { service_interactor }