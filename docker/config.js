let config = {
  address: '0.0.0.0', // default is 'localhost'
  port: 8080, // default
  ipWhitelist: [], // allow access from anywhere within network
  language: 'en',
  serverOnly: true,
  timeFormat: 24,
  units: 'metric',
  modules: [
    // {
    //   module: 'clock',
    //   position: 'top_right',
    // },
    // {
    //   module: 'calendar',
    //   header: 'US Holidays',
    //   position: 'bottom_right',
    //   config: {
    //     calendars: [
    //       {
    //         symbol: 'calendar-check',
    //         url: 'webcal://www.calendarlabs.com/ical-calendar/ics/76/US_Holidays.ics',
    //       },
    //     ],
    //   },
    // },
    // {
    //   module: 'compliments',
    //   position: 'bottom_center',
    // },
    {
      module: 'mmm-amazon-photos',
      position: 'fullscreen_below',
      config: {
        imageUrls: [
          'https://www.amazon.de/photos/share/gb5qG05BNuDH5P3R139RM3OvwUdCeseRAk4UXPR69O7',
        ],
        slideshowSpeed: 5000,
      },
    },
  ],
}

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config
}
