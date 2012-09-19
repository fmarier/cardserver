/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
conf = require('./configuration.js'),
mysql = require('mysql');

var client = mysql.createClient({
  user: conf.get('database').user,
  password: conf.get('database').password
});
client.query('USE ' + conf.get('database').name);

exports.get_cards = function (user_email, cb) {
    client.query(
        "SELECT id, name FROM card WHERE email = ? ORDER BY name", [user_email],
        function (err, results, fields) {
            if (err) {
                throw err;
            }
            cb(results);
        });
};

exports.create_card = function (name, email, cb) {
    if (!name) {
        cb(); // TODO: return an error
        return;
    }

    client.query(
        "INSERT INTO card(name, email) VALUES (?, ?)",
        [name, email], function (err, results, fields) {
            if (err) {
                throw err;
            }
            cb();
        });
};

exports.delete_card = function (card_id, email, cb) {
    client.query(
        "DELETE FROM card WHERE id = ? AND email = ?", [card_id, email],
        function (err, results, fields) {
            if (err) {
                throw err;
            }
            cb();
        });
};
