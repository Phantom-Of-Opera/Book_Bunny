CREATE OR REPLACE FUNCTION get_reader_books(selected_id INT DEFAULT NULL)
RETURNS TABLE (
  reader_name TEXT,
  book_title TEXT,
  book_cover_id TEXT,
  author_name TEXT,
  reader_id INT,
  book_id INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    readers.name::TEXT,
    books.book_title::TEXT,
    books.book_cover_id::TEXT,
    authors.author_name::TEXT,
	readers.id_reader::INT,
	books.id_book::INT
  FROM books_readers
  JOIN readers ON books_readers.id_reader = readers.id_reader
  JOIN books ON books_readers.id_book = books.id_book
  JOIN books_authors ON books.id_book = books_authors.id_book
  JOIN authors ON books_authors.id_author = authors.id_author
  WHERE selected_id IS NULL OR books_readers.id_reader = selected_id;
END;
$$ LANGUAGE plpgsql;