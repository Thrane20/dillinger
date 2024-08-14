import interactor_search from "../interactors/interactor_search";

var search = {
  searchLocalEntries: function (searchText) {
    return new Promise((resolve, reject) => {
      interactor_search.searchLocal(searchText).then((result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result);
        }
      });
    });
  },

  searchRemoteEntries: function (searchDb, searchText) {
    return new Promise((resolve, reject) => {
      interactor_search.searchRemote(searchDb, searchText).then((result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result);
        }
      });
    });
  },
};

export default search;
