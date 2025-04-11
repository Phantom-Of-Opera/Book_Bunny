CREATE OR REPLACE FUNCTION delete_reader_and_cleanup(reader_id INT)
RETURNS void AS
$$
BEGIN
  WITH deleted_reader_books AS (
    DELETE FROM books_readers
    WHERE id_reader = reader_id
    RETURNING id_book
  ),
  books_to_delete AS (
    SELECT b.id_book
    FROM books b
    LEFT JOIN books_readers br ON b.id_book = br.id_book
    WHERE br.id_book IS NULL
      AND b.id_book IN (SELECT id_book FROM deleted_reader_books)
  ),
  deleted_books_authors AS (
    DELETE FROM books_authors
    WHERE id_book IN (SELECT id_book FROM books_to_delete)
    RETURNING id_author
  ),
  deleted_books AS (
    DELETE FROM books
    WHERE id_book IN (SELECT id_book FROM books_to_delete)
    RETURNING id_book
  ),
  authors_to_delete AS (
    SELECT a.id_author
    FROM authors a
    LEFT JOIN books_authors ba ON a.id_author = ba.id_author
    WHERE ba.id_book IS NULL
      AND a.id_author IN (SELECT id_author FROM deleted_books_authors)
  ),
  deleted_authors AS (
    DELETE FROM authors
    WHERE id_author IN (SELECT id_author FROM authors_to_delete)
  )
  DELETE FROM readers
  WHERE id_reader = reader_id;
END;
$$ LANGUAGE plpgsql;