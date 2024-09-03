import axios from "axios";
import outcomes from "./interactor_outcomes";

var interactor_search = {
  searchLocal: async function (search) {
    // Guard the search for empties
    if (search?.length < 1) {
      return [];
    }

    // Call the backend
    try {
      const encodedSearch = encodeURIComponent(search);
      const response = await axios.get(
        "http://localhost:3060/search/local/" + search
      );
      console.log(response.data);
      return response.data;

    } catch (error) {
      console.log(error);
      return {
        error: error,
      };
    }
  },

  searchLocalBySlug: async function (slug) {
    // Guard the search for empties
    if (slug?.length < 1) {
      return [];
    }

    // Call the backend
    try {
      const encodedSearch = encodeURIComponent(slug);
      const response = await axios.get(
        "http://localhost:3060/slug/local/" + slug
      );
      console.log(response.data);
      return response.data;

    } catch (error) {
      console.log(error);
      return {
        error: error,
      };
    }
  },

  searchRemote: async function (searchDb, searchTitle) {
    // Guard the search for empties
    if (searchDb?.length < 1) {
      return [];
    }

    // Call the backend
    try {
      const encodedSearchDb = encodeURIComponent(searchDb);
      const encodedSearchTitle = encodeURIComponent(searchTitle);
      const response = await axios.get(
        "http://localhost:3060/search/remote/" + encodedSearchDb + "/" + encodedSearchTitle
      );
      console.log(response.data);
      return response.data;

    } catch (error) {
      console.log(error);
      return {
        error: error,
      };
    }
  },

  getRemoteTitle: async function (searchDb, slug) {
    // Guard the search for empties
    if (searchDb?.length < 1) {
      return [];
    }

    // Call the backend
    try {
      const encodedSearchDb = encodeURIComponent(searchDb);
      const encodedTitleSlug = encodeURIComponent(slug);
      const response = await axios.get(
        "http://localhost:3060/game/remote/" + encodedSearchDb + "/" + encodedTitleSlug
      );
      console.log(response.data);
      return response.data;

    } catch (error) {
      console.log(error);
      return {
        error: error,
      };
    }
  },
};

export default interactor_search;

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
