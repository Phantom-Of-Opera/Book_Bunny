import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import * as fs from "node:fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import axios from "axios";
import { Console } from "node:console";
import e from "express";
import { todo } from "node:test";

const app = express();

const port = process.env.PORT || 3000;

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use the commented lines below for local test of the code

const db = new pg.Pool({
	user: "postgres",
	host: "localhost",
	database: "girlslibrary",
	password: "Ph@nt0m",
	port: 5432,
});

//Use the paragraph below for Render deployment

// Use DATABASE_URL if on Render, else fallback to local for dev
// const db = new pg.Pool({
// 	connectionString: process.env.DATABASE_URL,
// 	ssl:
// 		process.env.NODE_ENV === "production"
// 			? { rejectUnauthorized: false }
// 			: false,
// });

const apiSearch = "https://openlibrary.org/search.json";

var listOfCollections = null;
// var selectedBook = null; -- Done
// var selectedAuthor = null; -- Done
// var errMsg = null; --Done
// var isMyAuthor = false; -- Done
// var isMyBook = false; -- Done

//------------ Use of App ----------------

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(
	session({
		secret: "books-bunny-secret", // 🐰 make this secure and unique in production!
		resave: false,
		saveUninitialized: false,
		cookie: {
			maxAge: 1000 * 60 * 60 * 2, // 2 hours
		},
	})
);

//------------- Handlers ----------------

app.listen(port, () => {
	console.log(`Server started, listening on port ${port}`);
});

app.get("/", async (req, res) => {
	//Get the list of collections from the database
	listOfCollections = await getCollections();
	//Get the list of books from the database
	const bookList = await getLibrary();
	res.render("home.ejs", {
		page: "home",
		bookList: bookList,
		userName: req.session.selectedName || null,
		userId: req.session.selectedUser || null,
		userIcon: req.session.selectedIcon || null,
		myBooks: false,
		hideAdd: req.session.selectedName === null,
	});
});

app.get("/authors", async (req, res) => {
	const authorList = await getAuthors();
	res.render("authors.ejs", {
		page: "authors",
		authorList: authorList,
		userName: req.session.selectedName || null,
		userId: req.session.selectedUser || null,
		userIcon: req.session.selectedIcon || null,
		myBooks: false,
		hideAdd: req.session.selectedName === null,
	});
});

app.get("/myBooks", async (req, res) => {
	const bookList = await getMyBooks(req.session.selectedUser);
	if (bookList == null) {
		res.redirect("/");
	} else {
		res.render("home.ejs", {
			page: "home",
			bookList: bookList,
			userName: req.session.selectedName || null,
			userId: req.session.selectedUser || null,
			userIcon: req.session.selectedIcon || null,
			myBooks: true,
			hideAdd: true,
		});
	}
});

app.get("/user", async (req, res) => {
	const resultUser = await db.query("SELECT * FROM readers ORDER BY name");
	res.render("user.ejs", {
		usersList: resultUser.rows,
		errMsg: req.session.errMsg,
		userName: req.session.selectedName || null,
		userIcon: req.session.selectedIcon || null,
		userId: req.session.selectedUser || null,
	});
});

app.get("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Logout error:", err);
			return res.status(500).send("Could not log out.");
		}
		res.redirect("/");
	});
});

app.post("/login", async (req, res) => {
	const newUser = req.body.isNewUser;
	if (newUser == null || newUser == "false") {
		req.session.selectedUser = parseInt(req.body.user);
		const submittedPwd = req.body.password;
		let passwordOK = await checkPassword(req.session, submittedPwd);

		if (passwordOK) {
			res.redirect("/myBooks");
		} else {
			res.redirect("/user");
		}
	} else {
		const newName = req.body.newName;
		const newIcon = req.body.newIcon;
		const newPwd = req.body.newPassword;
		const newEmail = req.body.newEmail;
		try {
			const newID = await db.query(
				"INSERT INTO readers (name, icon, password,email) VALUES ($1, $2, $3,$4) RETURNING id_reader",
				[newName, newIcon, newPwd, newEmail]
			);
			res.redirect("/user");
			req.session.selectedUser = newID.rows[0].id_reader;
			req.session.selectedName = newName;
			req.session.selectedIcon = newIcon;
			req.session.selectedEmail = newEmail;
		} catch (error) {
			console.error("Error inserting data:", error);
			res.status(500).send("Error inserting data");
		}
	}
});

app.post("/tab", (req, res) => {
	switch (req.body.tab) {
		case "New Book":
			res.render("newBook.ejs", {
				userName: req.session.selectedName || null,
				userIcon: req.session.selectedIcon || null,
			});
			break;

		case "myBooks":
			res.redirect("/myBooks");
			break;

		case "Library":
			res.redirect("/");
			break;

		case "Authors":
			res.redirect("/authors");
			break;

		case "Timeline":
			res.redirect("/timeline");
			break;

		case "Login":
			res.redirect("/user");
			break;

		default:
			res.send("OK");
			break;
	}
});

app.post("/searchbook", async (req, res) => {
	let searchKey = req.body.searchType;
	let searchValue = req.body.searchValue;
	let searchKey2 = req.body.searchType2;
	let searchValue2 = req.body.searchValue2;

	if (searchKey2 == searchKey) {
		searchKey2 = null;
		searchValue2 = null;
	}
	let searchString = new URLSearchParams({
		[searchKey]: searchValue,
		[searchKey2]: searchValue2,
	});
	try {
		let searchURL =
			apiSearch + "?" + searchString.toString().replace(/%20/g, "+");

		const response = await axios.get(searchURL);
		const result = response.data;

		res.json(result);
	} catch (error) {
		res.status(500).json({ error: "Something went wrong" });
	}
});

app.post("/addbook", async (req, res) => {
	const bookSelection = JSON.parse(req.body.selectedBooks);
	var newBook_id = null;
	var newAuthor_id = null;

	for (const book of bookSelection) {
		// Start by inserting the book info into the database
		newBook_id = await addBookId(book);
		// Now, manage the various authors of the book
		// for (const author of book.author_key) {
		for (const [index, author] of book.author_key.entries()) {
			const isMain = index === 0;
			//Retrieve the author_id from the database (add or fetch)
			newAuthor_id = await addAuthorId(author);

			// Get the rest of the information from the API (will update if information already exists)
			let newAuthor_info = await getAuthorInfo(author);
			let updateInfo = await updateAuthorInfo(newAuthor_info, newAuthor_id);
			if (!updateInfo) {
				console.log("Author info not updated");
			}
			// Insert the relationship into the books_authors table
			let insertAuthorBook = await addAuthorsBooks(
				newAuthor_id,
				newBook_id,
				isMain
			);
			if (!insertAuthorBook) {
				console.log("Author-book relationship not inserted");
			}
		}

		// Insert the relationship into the books_readers table
		let insertBookReader = await addBooksReaders(
			req.session.selectedUser,
			newBook_id
		);
		if (!insertBookReader) {
			console.log("Reader-book relationship not inserted");
		}

		// Insert the relationship into the authors_readers table
		let insertAuthorReader = await addAuthorsReaders(
			req.session.selectedUser,
			newAuthor_id
		);
		if (!insertAuthorReader) {
			console.log("Reader-author relationship not inserted");
		}
	}
	res.render("newBook.ejs", {
		userName: req.session.selectedName || null,
		userIcon: req.session.selectedIcon || null,
	});
});

app.post("/moreAuthor", async (req, res) => {
	let authorId = parseInt(req.body.key);
	// console.log("Author id: ", authorId);
	const itsOK = await getThisAuthor(req.session, authorId);
	if (itsOK) {
		res.render("thisAuthor.ejs", {
			page: "thisAuthor",
			thisAuthor: req.session.selectedAuthor,
			userId: req.session.selectedUser || null,
			isMyAuthor: req.session.isMyAuthor,
		});
	} else {
		res.json("Error");
	}
});

app.post("/moreBook", async (req, res) => {
	let bookId = parseInt(req.body.key);
	//Get the book information from the database
	const itsOK = await getThisBook(req.session, bookId);
	if (itsOK) {
		res.json("OK");
	} else {
		res.json("Error");
	}
});

//get the specific author page
app.get("/thisAuthor", async (req, res) => {
	//Get the book information from the database
	res.render("thisAuthor.ejs", {
		page: "thisAuthor",
		thisAuthor: req.session.selectedAuthor,
		userId: req.session.selectedUser || null,
		isMyAuthor: req.session.isMyAuthor,
	});
});

app.get("/thisBook", async (req, res) => {
	//Get the list of collections from the database
	listOfCollections = await getCollections();
	//Render the page
	res.render("thisBook.ejs", {
		page: "thisBook",
		thisBook: req.session.selectedBook || null,
		userId: req.session.selectedUser || null,
		userName: req.session.selectedName || null,
		userIcon: req.session.selectedIcon || null,
		collections: listOfCollections,
		isMyBook: req.session.isMyBook || false,
	});
});

app.post("/addOne", async (req, res) => {
	console.log("Adding book and author");
	//Get the book information from the database
	const bookId = parseInt(req.body.bookId);
	const userId = parseInt(req.body.userId);
	const fetchAuthorId = await db.query(
		"SELECT id_author FROM books_authors WHERE id_book=$1",
		[bookId]
	);
	const authorId = fetchAuthorId.rows[0].id_author;
	const insertBookReader = await addBooksReaders(userId, bookId);
	const insertAuthorReader = await addAuthorsReaders(userId, authorId);
	if (insertBookReader && insertAuthorReader) {
		console.log("Insert successful");
		res.status(200);
		res.redirect("/myBooks");
	} else {
		console.log("Insert failed");
		res.status(500);
	}
});

app.post("/saveAuthor", async (req, res) => {
	if (req.session.selectedUser !== null) {
		//Save the author in the database

		let saveOk = updateAuthorAnalysis(
			req.body.authorId,
			req.body.userId,
			req.body.authorNotes,
			req.body.authorRating,
			req.body.authorGenre
		);
		if (saveOk) {
			res.status(200);
		} else {
			console.log("Update failed");
			res.status(500);
		}
	} else {
		res.status(500);
	}
});

app.post("/saveBook", (req, res) => {
	//Save the book analysis in the database
	let saveOk = updateBookAnalysis(
		req.body.bookId,
		req.body.userId,
		req.body.bookAnalysis,
		req.body.bookStructure,
		req.body.bookRating,
		req.body.bookCollection
	);
	if (saveOk) {
		res.status(200);
	} else {
		console.log("Update failed");
		res.status(500);
	}
	// res.redirect("/");
});

app.post("/delete", async (req, res) => {
	//Delete the record in books_readers with the bookId and userId
	const bookId = req.body.bookId;
	const userId = req.body.userId;
	const deleteWork = await db.query("SELECT delete_book($1,$2)", [
		userId,
		bookId,
	]);
	if (deleteWork) {
		console.log("Delete successful");
		res.redirect("/myBooks");
	} else {
		console.log("Delete failed");
		res.status(500);
	}
});

app.get("/timeline", async (req, res) => {
	let timeAllBooks = null;
	let timeAllAuthors = null;
	let timeMyBooks = null;
	let timeMyAuthors = null;
	// Has a first go at all the library authors
	let resultAuthors = await db.query(
		"SELECT DISTINCT author_name, author_birth_date, author_death_date FROM authors JOIN books_authors ON books_authors.id_author = authors.id_author WHERE books_authors.is_main = true and author_birth_date IS NOT NULL ORDER BY author_birth_date"
	);
	timeAllAuthors = resultAuthors.rows;
	// Has a first go at all the library books
	let resultBooks = await db.query(
		"SELECT DISTINCT books.book_title, books.book_first_publish FROM books ORDER BY book_first_publish"
	);
	timeAllBooks = resultBooks.rows;
	//Check if there is a user selected
	if (req.session.selectedUser !== null) {
		//Get the list of myBooks
		let resultMyBooks = await db.query(
			"SELECT book_title, book_first_publish FROM main_fields WHERE id_reader=$1 ORDER BY book_first_publish",
			[req.session.selectedUser]
		);
		timeMyBooks = resultMyBooks.rows;
		//Get the list of myAuthors
		let resultMyAuthors = await db.query(
			"SELECT DISTINCT author_name, author_birth_date, author_death_date FROM main_fields WHERE id_reader=$1 ORDER BY author_birth_date",
			[req.session.selectedUser]
		);
		timeMyAuthors = resultMyAuthors.rows;
	}
	res.render("timeline.ejs", {
		allAuthors: timeAllAuthors,
		myAuthors: timeMyAuthors,
		myBooks: timeMyBooks,
		allBooks: timeAllBooks,
		userName: req.session.selectedName || null,
		userIcon: req.session.selectedIcon || null,
		userId: req.session.selectedUser || null,
		hideAdd: req.session.selectedName === null,
	});
});

app.post("/deleteReader", async (req, res) => {
	if (req.body.confirmPhrase === "I want to delete my Account!") {
		if (await checkPassword(req.session, req.body.deletePwd)) {
			// Delete the record in readers with the userId
			const deleteWork = await db.query(
				"SELECT delete_reader_and_cleanup($1)",
				[req.session.selectedUser]
			);
			if (deleteWork) {
				console.log("Delete successful");
				req.session.selectedUser = null;
				req.session.selectedName = null;
				req.session.selectedIcon = null;
				req.session.errMsg = null;

				res.redirect("/");
			} else {
				console.log("Delete failed");
				res.status(500);
			}
		} else {
			console.log("Password is incorrect");
			req.session.errMsg = "Password is incorrect, you have been logged out";
			res.redirect("/user");
		}
	} else {
		console.log("Delete request not confirmed");
		req.session.errMsg =
			"Please confirm the deletion by typing 'I want to delete my Account!'";
		res.redirect("/user");
	}
});

//----------------
//----------------
//----------------
//---------------- Functions ----------------
//----------------
//----------------
//----------------

async function getLibrary() {
	try {
		let result = null;
		result = await db.query("SELECT * FROM book_fields ORDER BY book_title");
		return result.rows;
	} catch (err) {
		console.error("Error executing query", err.stack);
		return null;
	}
}

async function getMyBooks(idReader) {
	if (idReader == null) {
		return null;
	} else {
		try {
			let result = null;

			result = await db.query("SELECT * FROM get_reader_books($1)", [idReader]);

			return result.rows;
		} catch (err) {
			console.error("Error executing query", err.stack);
			return null;
		}
	}
}

function parseDateString(dateStr) {
	const parsed = new Date(dateStr);

	if (!isNaN(parsed.getTime())) {
		// Return in Postgres-friendly YYYY-MM-DD format
		return parsed.toISOString().split("T")[0];
	}

	return null;
}

function categorizeSQLError(err) {
	switch (err.code) {
		case "23505":
			return { type: "DUPLICATE", message: "Duplicate key" };
		case "08006":
		case "08003":
			return { type: "CONNECTION", message: "Connection error" };
		case "23503":
			return { type: "FK_VIOLATION", message: "Foreign key constraint failed" };
		case "22P02":
			return { type: "BAD_DATA", message: "Invalid format" };
		default:
			return { type: "UNKNOWN", message: err.message };
	}
}

async function getAuthorInfo(authorRef) {
	//get the rest of the information from the API
	let authorInfo = {
		name: null,
		bio: null,
		birth: null,
		death: null,
		pic: null,
		links: null,
	};
	const authorURL = `https://openlibrary.org/authors/${authorRef}.json`;
	const authorData = await axios.get(authorURL);

	authorInfo.name = authorData.data.name || "no name";
	authorInfo.bio = authorData.data.bio || "no bio";
	if (authorData.data.birth_date) {
		authorInfo.birth = parseDateString(authorData.data.birth_date);
	} else {
		authorInfo.birth = null;
	}
	if (authorData.data.death_date) {
		authorInfo.death = parseDateString(authorData.data.death_date);
	} else {
		authorInfo.death = null;
	}
	if (authorData.data.photos) {
		authorInfo.pic = authorData.data.photos[0];
	} else {
		authorInfo.pic = null;
	}
	if (authorData.data.links) {
		authorInfo.links = JSON.stringify(authorData.data.links);
	} else {
		authorInfo.links = null;
	}

	return authorInfo;
}

async function updateAuthorInfo(authorInfo, authorId) {
	let updateResult = false;

	try {
		await db.query(
			"UPDATE authors SET author_name = $1, author_top_work = $2, author_birth_date = $3, author_death_date = $4, author_wikidata = $5, author_links=$6 WHERE id_author = $7",
			[
				authorInfo.name,
				authorInfo.bio,
				authorInfo.birth,
				authorInfo.death,
				authorInfo.pic,
				authorInfo.links,
				authorId,
			]
		);

		//Delete the records where name is null
		// try {
		// 	await db.query("DELETE FROM authors WHERE author_name IS NULL");
		// } catch (err) {
		// 	console.log("Error deleting authors with null name");
		// }
		updateResult = true;
	} catch (err) {
		console.log(
			"Error updating author information for author:",
			authorInfo.name
		);
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.log("Author info already exists in the database: ", authorInfo);
		} else if (problem.type === "CONNECTION") {
			console.log("Connection isssue while updating author info database");
		} else {
			console.error("Error updating author info");
			console.error("Unexpected SQL issue with author information:", problem);
		}
	}
	return updateResult;
}

async function addAuthorId(authorRef) {
	//Insert the author into a database and return the author_id
	let authorId = null;
	let authorKey = null;
	try {
		authorKey = await db.query(
			"INSERT INTO authors (author_key) VALUES ($1) RETURNING id_author",
			[authorRef]
		);
		authorId = parseInt(authorKey.rows[0].id_author);
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			// Get the newAuthor_id of the author that already exist in the db
			try {
				authorKey = await db.query(
					"SELECT id_author FROM authors WHERE author_key = $1",
					[authorRef]
				);
				authorId = parseInt(authorKey.rows[0].id_author);
				console.log("I found the author with id: ", authorId);
			} catch (err) {
				console.log(
					"Error getting the author id that is already in the database"
				);
				console.log(err);
			}
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting author:", problem);
		} else {
			console.error("Unexpected SQL issue on add author id:", problem);
		}
	}
	return parseInt(authorId);
}

async function getBookDetails(bookRef) {
	let bookSummary = null;
	let bookLinks = null;
	// Get the works json file from OpenLibrary using the bookRef.works reference
	try {
		let worksURL = `https://openlibrary.org/${bookRef.works}.json`;
		let worksData = await axios.get(worksURL);
		bookSummary = worksData.data.description.value || "no description";
		bookLinks = worksData.data.links || null;
		if (bookLinks) {
			bookLinks = JSON.stringify(bookLinks);
		} else {
			bookLinks = null;
		}
	} catch (err) {
		console.log("Error fetching works data for book:", bookRef.works);
		console.log("Error:", err);
		// Set default values
		bookSummary = null;
		bookLinks = null;
	}
	return {
		bookSummary: bookSummary,
		bookLinks: bookLinks,
	};
}

async function addBookId(bookRef) {
	let bookId = null;
	let bookKey = null;

	const { bookSummary, bookLinks } = await getBookDetails(bookRef);

	bookRef.bookSummary = bookSummary;
	bookRef.bookLinks = bookLinks;
	//Insert the book into a database and return the book_id
	try {
		bookKey = await db.query(
			"INSERT INTO books (book_title, book_cover_id, book_first_publish, book_oleid, book_works,book_summary,book_links) VALUES ($1, $2, $3, $4, $5, $6,$7) RETURNING id_book",
			[
				bookRef.title,
				bookRef.cover,
				bookRef.publish,
				bookRef.oleId,
				bookRef.works,
				bookRef.bookSummary,
				bookRef.bookLinks,
			]
		);
		bookId = bookKey.rows[0].id_book;
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			try {
				console.log(
					"Trying to get the book id that is already in the database"
				);
				// Get the book_id of the book that already exist in the db
				bookKey = await db.query(
					"SELECT id_book FROM books WHERE book_oleid = $1",
					[bookRef.oleId]
				);

				bookId = bookKey.rows[0].id_book;
			} catch (err) {
				console.log(
					"Error getting the book id that is already in the database"
				);
				console.log(err);
			}
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting book:", bookRef);
		} else {
			console.error("Error inserting book");
			console.error("Unexpected SQL issue on add book Id:", problem);
		}
	}
	return parseInt(bookId);
}

async function addAuthorsBooks(authorId, bookId, isMain) {
	let insertResult = false;
	//Insert the relationship into the books_authors table
	try {
		await db.query(
			"INSERT INTO books_authors (id_book, id_author, is_main) VALUES ($1, $2, $3)",
			[bookId, authorId, isMain]
		);
		insertResult = true;
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.error("Error inserting books_authors: Shows DUPLICATE");
		} else if (problem.type === "CONNECTION") {
			// maybe restart DB connection?
			console.error("Error inserting books_authors: Shows CONNECTION");
		} else {
			console.error("Error inserting books_authors");
			console.error("Unexpected SQL issue in books Authors:", problem);
		}
	}
	return insertResult;
}

async function addBooksReaders(readerId, bookId) {
	let insertResult = false;
	//Insert the relationship into the books_readers table
	try {
		await db.query(
			"INSERT INTO books_readers (id_book, id_reader) VALUES ($1, $2)",
			[bookId, readerId]
		);
		insertResult = true;
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.log("The reader already read that book");
			return true;
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting books_readers");
		} else {
			console.error("Error inserting books_readers:");
			console.error("Unexpected SQL issue in book_reader:", problem);
		}
	}
	return insertResult;
}

async function addAuthorsReaders(readerId, authorId) {
	let insertResult = false;
	//Insert the relationship into the books_readers table
	try {
		await db.query(
			"INSERT INTO authors_readers (id_author, id_reader) VALUES ($1, $2)",
			[authorId, readerId]
		);
		insertResult = true;
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.log("The reader already conected to that author");
			return true;
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting authors_readers");
		} else {
			console.error("Error inserting authors_readers:");
			console.error("Unexpected SQL issue in author_reader:", problem);
		}
	}
	return insertResult;
}

async function updateAuthorAnalysis(writerId, userId, Notes, Rating, Genre) {
	let updateResult = false;
	//Insert the relationship into the authors_readers table

	try {
		await db.query(
			"UPDATE authors_readers SET author_notes = $1, author_rating = $2, author_genre= $3 WHERE id_author = $4 AND id_reader = $5",
			[Notes, Rating, Genre, writerId, userId]
		);
		updateResult = true;
	} catch (err) {
		console.log("Error updating authors_readers");
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.error("Error updating authors_readers: Shows DUPLICATE");
		} else if (problem.type === "CONNECTION") {
			console.error("Error updating authors_readers: Shows CONNECTION");
		} else {
			console.error("Error updating authors_readers");
			console.error("Unexpected SQL issue in update book analysis:", problem);
		}
	}
	return updateResult;
}

async function updateBookAnalysis(
	bookId,
	userId,
	Analysis,
	Structure,
	Rating,
	Collection
) {
	let updateResult = false;
	//Insert the relationship into the books_readers table

	try {
		await db.query(
			"UPDATE books_readers SET book_notes = $1, book_structure = $2, book_rating = $3, book_collection= $4 WHERE id_book = $5 AND id_reader = $6",
			[Analysis, Structure, Rating, Collection, bookId, userId]
		);
		updateResult = true;
	} catch (err) {
		console.log("Error updating books_readers");
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.error("Error updating books_readers: Shows DUPLICATE");
		} else if (problem.type === "CONNECTION") {
			console.error("Error updating books_readers: Shows CONNECTION");
		} else {
			console.error("Error updating books_readers");
			console.error("Unexpected SQL issue in update book analysis:", problem);
		}
	}
	return updateResult;
}

async function checkPassword(session, tryPwd) {
	let userId = session.selectedUser;
	try {
		const resultPwd = await db.query(
			"SELECT * FROM readers WHERE id_reader=$1",
			[userId]
		);
		const goodPwd = resultPwd.rows[0].password;
		if (tryPwd == goodPwd) {
			session.errMsg = null;
			session.selectedName = resultPwd.rows[0].name;
			session.selectedIcon = resultPwd.rows[0].icon;
			session.selectedEmail = resultPwd.rows[0].email;
			return true;
		} else {
			session.selectedUser = null;
			session.errMsg = "Password is incorrect";
			session.selectedName = null;
			session.selectedIcon = null;
			return false;
		}
	} catch (error) {
		console.error("Error executing query", error.stack);
		return false;
	}
}

async function getCollections() {
	//Get the list of collections from the database
	const collectList = await db.query(
		"SELECT collection_name FROM collections ORDER BY collection_name"
	);
	return collectList.rows;
}

async function getAuthors() {
	//Get the list of authors from the database
	const authorList = await db.query(
		"SELECT DISTINCT * FROM authors ORDER BY author_name"
	);
	const cleanList = authorList.rows;
	cleanList.forEach((author) => {
		author.author_birth_date = parseDateString(author.author_birth_date);
		if (author.author_death_date) {
			author.author_death_date = parseDateString(author.author_death_date);
		}
	});
	return cleanList;
}

async function getThisAuthor(session, writerId) {
	let queryStr = "";
	let queryParams = [];
	let userId = session.selectedUser;
	session.isMyAuthor = false;
	//Check if the selected author has been read by the user
	let hasRead = await db.query(
		"SELECT * FROM main_fields WHERE id_author=$1 AND id_reader=$2",
		[writerId, userId]
	);

	if (hasRead.rows.length > 0) {
		session.isMyAuthor = true;
	} else {
		session.isMyAuthor = false;
	}

	if (userId == null || session.isMyAuthor == false) {
		queryStr = "SELECT * FROM author_fields WHERE id_author=$1";
		queryParams = [writerId];
	} else {
		queryStr = "SELECT * FROM main_fields WHERE id_author=$1 AND id_reader=$2";
		queryParams = [writerId, userId];
	}

	try {
		let result = await db.query(queryStr, queryParams);

		session.selectedAuthor = result.rows[0];
		session.selectedAuthor.author_birth_date = parseDateString(
			session.selectedAuthor.author_birth_date
		);
		if (session.selectedAuthor.author_death_date) {
			session.selectedAuthor.author_death_date = parseDateString(
				session.selectedAuthor.author_death_date
			);
		}
		if (session.selectedAuthor.author_links) {
			session.selectedAuthor.author_links = JSON.parse(
				session.selectedAuthor.author_links
			);
		}

		return true;
	} catch (error) {
		console.error("Error executing query", error.stack);
		return null;
	}
}

async function getThisBook(session, bookId) {
	let queryStr = "";
	let queryParams = [];
	let userId = session.selectedUser;
	session.isMyBook = false;
	//Check if the selected book has been read by the user
	let hasRead = await db.query(
		"SELECT * FROM main_fields WHERE id_book=$1 AND id_reader=$2",
		[bookId, userId]
	);
	if (hasRead.rows.length > 0) {
		session.isMyBook = true;
	} else {
		session.isMyBook = false;
	}
	//Get the book information from the database
	if (userId == null || session.isMyBook == false) {
		queryStr = "SELECT DISTINCT * FROM book_fields WHERE id_book=$1";
		queryParams = [bookId];
	} else {
		queryStr = "SELECT * FROM main_fields WHERE id_book=$1 AND id_reader=$2";
		queryParams = [bookId, userId];
	}

	try {
		let result = await db.query(queryStr, queryParams);
		session.selectedBook = result.rows[0];
		if (session.selectedBook.book_links) {
			session.selectedBook.book_links = JSON.parse(
				session.selectedBook.book_links
			);
		}
		return true;
	} catch (error) {
		console.error("Error executing query", error.stack);
		return null;
	}
}
