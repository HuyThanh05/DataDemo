-- Run in MySQL Workbench as root before importing the two business samples.
-- Limited to the two new tables; no permission on exam_scores is changed.
GRANT SELECT, INSERT, CREATE ON datademo_source.superstore_sales
TO 'datademo_app_user'@'localhost';
GRANT SELECT, INSERT, CREATE ON datademo_source.coffee_shop_sales
TO 'datademo_app_user'@'localhost';
