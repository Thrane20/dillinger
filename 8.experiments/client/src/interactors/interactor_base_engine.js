import axios from "axios";
import outcomes from "./interactor_outcomes";

var interactor_base_engine = {
  getDockerStatus: async function () {
    try {
      const response = await axios.get(
        "http://localhost:3060/diag/docker_status"
      );
      return {
        status: response.data.up_status,
        outcome:
          response?.data?.up_status === "Up"
            ? outcomes.docker_up
            : outcomes.docker_down,
      };
    } catch (error) {
      console.error(error);
      return {
        status: outcomes.dillinger_unreachable.title,
        outcome: outcomes.dillinger_unreachable,
      };
    }
  },

  refresh_game_cache: async function () {
    try {
      const response = await axios.get(
        "http://localhost:3060/mgmt/build_game_cache"
      );
      return {
        status: "ok",
      };
    } catch (error) {
      console.error(error);
      return {
        status: "error",
      };
    }
  },
};

export default interactor_base_engine;