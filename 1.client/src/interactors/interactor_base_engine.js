import axios from 'axios';
import { outcomes } from './interactor_outcomes';

var interactor_base_engine = {

    getDockerStatus: async function () {
        try {
            const response = await axios.get('http://localhost:3060/diag/docker_status');
            return {
                status: response.data.up_status,
                outcome: (response.data.up_status === "Up") ? outcomes.docker_up : outcomes.docker_down
            };
            return response.data.up_status;
        } catch (error) {
            console.error(error);
            return {
                status: outcomes.dillinger_unreachable.title,
                outcome: outcomes.dillinger_unreachable
            };
        }
    },

};

export default interactor_base_engine;



// async function postToWebService() {
//     try {
//         const data = {
//             // Add your request payload here
//         };

//         const response = await axios.post('https://api.example.com/data', data);
//         console.log(response.data);
//         // Process the response data here
//     } catch (error) {
//         console.error(error);
//         // Handle the error here
//     }
// }

// export 
