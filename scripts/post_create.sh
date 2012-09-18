#!/bin/bash
sudo /sbin/chkconfig mysqld on
sudo /sbin/service mysqld start
echo "CREATE DATABASE cardserver CHARACTER SET utf8;" | mysql -uroot
echo "GRANT ALL ON cardserver.* TO 'nodeuser'@'localhost' IDENTIFIED BY 'nodeuser';" | mysql -uroot
