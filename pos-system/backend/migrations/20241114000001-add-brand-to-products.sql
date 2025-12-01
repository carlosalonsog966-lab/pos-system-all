-- Migration to add missing brand column to products table
ALTER TABLE products ADD COLUMN brand VARCHAR(100);