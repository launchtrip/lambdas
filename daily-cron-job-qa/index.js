const axios = require('axios');

exports.handler = async (event) => {
  // for event
  const eventLink = ` https://qa-app-be.launchtrip.com/events/v2/events/outdated-events`;
  // for trips
  const tripsLink = `https://qa-app-be.launchtrip.com/trips/v1/archive-trips`;

  await Promise.allSettled([axios.post(tripsLink, {}), axios.delete(eventLink)]).then((res) => {
    res.forEach((ele) => {
      if (ele.status === 'rejected') {
        console.log(ele);
      }
    });
  });
};
