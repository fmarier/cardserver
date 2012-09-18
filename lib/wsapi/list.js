/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
wsapi = require('../wsapi.js');

const
cards = require('../cards.js');

exports.url = '/list';
exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';

exports.process = function(req, res) {
    var user_email = req.session.userid;
    var user_cards = cards.get_cards(
        user_email, function (user_cards) {
            res.render('list.ejs', {cards: user_cards});
        });
};
