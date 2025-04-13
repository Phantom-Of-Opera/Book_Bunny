CREATE OR REPLACE FUNCTION delete_reader_and_cleanup(reader_id INT)
RETURNS void AS
$$
DECLARE
  reader_book_ids INT[] := ARRAY[]::INT[];
  orphaned_book_ids INT[] := ARRAY[]::INT[];
  author_ids INT[] := ARRAY[]::INT[];
BEGIN
  -- Step 1: Get all books this reader has read
  SELECT ARRAY_AGG(DISTINCT id_book)
  INTO reader_book_ids
  FROM books_readers
  WHERE id_reader = reader_id;

  IF reader_book_ids IS NULL OR array_length(reader_book_ids, 1) = 0 THEN
    RAISE NOTICE 'Reader % has no books to delete.', reader_id;
    RETURN;
  END IF;

  -- Step 2: Identify orphaned books (books only this reader has read)
  SELECT ARRAY_AGG(id_book)
  INTO orphaned_book_ids
  FROM (
    SELECT br.id_book
    FROM books_readers br
    WHERE br.id_book = ANY(reader_book_ids)
    GROUP BY br.id_book
    HAVING COUNT(DISTINCT br.id_reader) = 1 -- Only one reader (the current one)
  ) orphaned;

  -- Step 3: Delete this reader's book entries
  DELETE FROM books_readers
  WHERE id_reader = reader_id;

  -- Step 4: Get authors linked to the orphaned books
  SELECT ARRAY_AGG(DISTINCT id_author)
  INTO author_ids
  FROM books_authors
  WHERE id_book = ANY(orphaned_book_ids);

  -- Step 5: Delete books_authors links for orphaned books
  DELETE FROM books_authors
  WHERE id_book = ANY(orphaned_book_ids);

  -- Step 6: Delete authors who are now unlinked from any books
  DELETE FROM authors
  WHERE id_author = ANY(author_ids)
    AND id_author NOT IN (
      SELECT DISTINCT id_author FROM books_authors
    );

  -- Step 7: Delete the orphaned books
  DELETE FROM books
  WHERE id_book = ANY(orphaned_book_ids);

  -- Step 8: Delete the reader
  DELETE FROM readers
  WHERE id_reader = reader_id;

  -- Optional log
  RAISE NOTICE 'Deleted reader %, orphaned books %, orphaned authors %',
    reader_id,
    orphaned_book_ids,
    author_ids;
END;
$$ LANGUAGE plpgsql;