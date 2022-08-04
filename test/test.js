require('dotenv').load();
const chai        = require('chai');
const script      = require('../lib/script.js');
const facebookAPI = require('./fake-facebook-api.js');
const nock        = require('nock');
const mongoose    = require('mongoose');
const Post        = require('../models/post');
const expect      = chai.expect;

const posts = [
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-22',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-23',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-24',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-25',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-26',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-02-27',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  },
  {
    message: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    created_time: '2019-03-28',
    full_picture: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1',
    postLink: 'https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Ft4.kn3.net%2Ftaringa%2F8%2FD%2F4%2F3%2F5%2FF%2FMartinKiuon%2F1A1.png&f=1'
  }
];

nock('http://www.facebook.com')
  .persist()
  .get('/')
  .reply(200, posts)

describe('Script Test', function() {
  describe('Save 7 posts for 10 accounts', function() {
    before(function () {
      Post.deleteMany({}, function() {});
      script.checkPosts(facebookAPI)
    });
    it('I should have 70 posts saved in databases ', function() {
        Post.find({}, function(err, posts) {
          expect(70).to.equal(posts.length)
        });
    });
  });
});
