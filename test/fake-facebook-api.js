const axios = require('axios');

function getPost() {
  return axios.get('http://www.facebook.com/').then(response => {
    return response.data
  });
}

module.exports = {
  getPost
}
