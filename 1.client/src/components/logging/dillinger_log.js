import { v4 as uuidv4 } from 'uuid'

function createLog(message) {
    return {
        id: uuidv4(),
        time: new Date().toLocaleTimeString(),
        message: message,
    };
}

export default createLog;
