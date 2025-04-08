import express from "express";
import bodyParser from "body-parser";
import * as fs from "node:fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import axios from "axios";
import { Console } from "node:console";

const app = express();
const port = 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new pg.Pool({
	user: "postgres",
	host: "localhost",
	database: "girlslibrary",
	password: "Ph@nt0m",
	port: 5432,
});
const apiSearch = "https://openlibrary.org/search.json";

var selectedUser = null;
var selectedName = null;
var selectedIcon = null;
var selectedBook = null;
var errPwd = false;

//------------ Use of App ----------------

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

//------------- Handlers ----------------

app.listen(port, () => {
	console.log(`Server started, listening on port ${port}`);
});

app.get("/", async (req, res) => {
	const bookList = await getFromDatabase(selectedUser);
	res.render("home.ejs", {
		page: "home",
		bookList: bookList,
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

app.get("/user", async (req, res) => {
	const resultUser = await db.query("SELECT * FROM readers ORDER BY name");
	res.render("user.ejs", {
		usersList: resultUser.rows,
		errPwd: errPwd,
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

app.get("/logout", (req, res) => {
	selectedUser = null;
	selectedName = null;
	selectedIcon = null;
	errPwd = false;
	res.redirect("/");
});

app.post("/login", async (req, res) => {
	const newUser = req.body.isNewUser;
	if (newUser == null || newUser == "false") {
		selectedUser = parseInt(req.body.user);
		const submittedPwd = req.body.password;
		try {
			const resultPwd = await db.query(
				"SELECT * FROM readers WHERE id_reader=$1",
				[selectedUser]
			);
			const goodPwd = resultPwd.rows[0].password;
			if (submittedPwd == goodPwd) {
				errPwd = false;
				selectedName = resultPwd.rows[0].name;
				selectedIcon = resultPwd.rows[0].icon;
				res.redirect("/");
			} else {
				selectedUser = null;
				errPwd = true;
				selectedName = null;
				selectedIcon = null;
				res.redirect("/user");
			}
		} catch (error) {
			res.redirect("/user");
		}
	} else {
		const newName = req.body.newName;
		const newIcon = req.body.newIcon;
		const newPwd = req.body.newPassword;
		try {
			const newID = await db.query(
				"INSERT INTO readers (name, icon, password) VALUES ($1, $2, $3) RETURNING id_reader",
				[newName, newIcon, newPwd]
			);
			res.redirect("/user");
			selectedUser = newID.rows[0].id_reader;
			selectedName = newName;
			selectedIcon = newIcon;
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
				userName: selectedName,
				userIcon: selectedIcon,
			});
			break;

		case "Show Library":
			res.redirect("/");
			break;

		default:
			res.send("OK");
			break;
	}
});

app.post("/searchbook", async (req, res) => {
	let searchKey = req.body.searchType;
	let searchValue = req.body.searchTitle;
	let searchString = new URLSearchParams({
		[searchKey]: searchValue,
	});
	try {
		let searchURL =
			apiSearch + "?" + searchString.toString().replace(/%20/g, "+");

		const response = await axios.get(searchURL);
		const result = response.data;

		res.json(result);
	} catch (error) {
		console.error(error);
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
		let insertBookReader = await addBooksReaders(selectedUser, newBook_id);
		if (!insertBookReader) {
			console.log("Reader-book relationship not inserted");
		}
	}
	res.render("newBook.ejs", {
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

app.post("/select", async (req, res) => {
	console.log("Clicking");
	console.log(req.body.key);
	let bookId = parseInt(req.body.key);
	try {
		let result = await db.query(
			"SELECT * FROM main_fields WHERE id_book=$1 AND id_reader=$2",
			[bookId, selectedUser]
		);
		console.log(result.rows);
		selectedBook = result.rows[0];
	} catch (error) {
		console.error("Error executing query", error.stack);
		return null;
	}
	console.log("Selected book:", selectedBook);
	res.json("OK");
});

app.get("/book", (req, res) => {
	console.log("Rendering book page");
	console.log("Selected book:", selectedBook);
	res.render("book.ejs", {
		thisBook: selectedBook,
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

// app.post("/new", (req, res) => {
// 	selectBlog = [
// 		{
// 			blogAuthor: "Your name",
// 			blogTitle: "Title of your blog",
// 			blogText: "Your blog text",
// 		},
// 	];
// 	res.send("OK");
// });

// app.post("/submit", (req, res) => {
// 	var newBlog = {
// 		blogAuthor: req.body.author,
// 		blogTitle: req.body.title,
// 		blogText: req.body.blogText,
// 		blogKey: req.body.title + "|" + req.body.author,
// 		blogDate: new Date(),
// 	};

// 	addToFile(newBlog);
// 	res.redirect("/");
// });

app.post("/delete", (req, res) => {
	removeFromFile(req.body.key);
	res.json("Deletion successful");
});

//---------------- Functions ----------------

async function getFromDatabase(idReader) {
	try {
		let result = null;
		if (idReader == null) {
			result = await db.query(
				"SELECT * FROM book_author_view ORDER BY book_title"
			);
		} else {
			result = await db.query("SELECT * FROM get_reader_books($1)", [idReader]);
		}
		return result.rows;
	} catch (err) {
		console.error("Error executing query", err.stack);
		return null;
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
		work: null,
		birth: null,
		death: null,
		wiki: null,
	};
	try {
		const authorURL = `https://openlibrary.org/authors/${authorRef}.json`;
		const authorData = await axios.get(authorURL);
		authorInfo.name = authorData.data.name || "no name";
		authorInfo.work = authorData.data.top_work || "no work";
		authorInfo.birth = parseDateString(authorData.data.birth_date);
		authorInfo.death = parseDateString(authorData.data.death_date);
		authorInfo.wiki = "wikidata"; //authorData.data.remote_ids["wikidata"];
	} catch (err) {
		// If the author data is not available, set default values
		console.log("Error fetching author data for author:", authorRef);
		console.log("Error:", err);
		// Set default values
		authorInfo.name = null;
		authorInfo.work = null;
		authorInfo.birth = null;
		authorInfo.death = null;
		authorInfo.wiki = null;
	}
	return authorInfo;
}

async function updateAuthorInfo(authorInfo, authorId) {
	let updateResult = false;

	try {
		await db.query(
			"UPDATE authors SET author_name = $1, author_top_work = $2, author_birth_date = $3, author_death_date = $4, author_wikidata = $5 WHERE id_author = $6",
			[
				authorInfo.name,
				authorInfo.work,
				authorInfo.birth,
				authorInfo.death,
				authorInfo.wiki,
				authorId,
			]
		);

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
		console.log("Failed insert author:", authorRef);
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.log("Author already exists in the database: ", authorRef);
			// Get the newAuthor_id of the author that already exist in the db
			authorKey = await db.query(
				"SELECT id_author FROM authors WHERE author_key = $1",
				[authorRef]
			);
			authorId = parseInt(authorKey.rows[0].id_author);
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting author:", problem);
		} else {
			console.error("Unexpected SQL issue on add author id:", problem);
		}
	}
	return parseInt(authorId);
}

async function getBookWork(bookRef) {
	let bookSummary = null;
	// Get the works json file from OpenLibrary using the bookRef.works reference
	try {
		let worksURL = `https://openlibrary.org/${bookRef.works}.json`;
		let worksData = await axios.get(worksURL);
		bookSummary = worksData.data.description.value || "no description";
	} catch (err) {
		console.log("Error fetching works data for book:", bookRef.works);
		console.log("Error:", err);
		// Set default values
		bookSummary = null;
	}
	return bookSummary;
}

async function addBookId(bookRef) {
	let bookId = null;
	let bookKey = null;
	bookRef.bookSummary = await getBookWork(bookRef);
	//Insert the book into a database and return the book_id
	try {
		bookKey = await db.query(
			"INSERT INTO books (book_title, book_cover_id, book_first_publish, book_oleid, book_works,book_summary) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_book",
			[
				bookRef.title,
				bookRef.cover,
				bookRef.publish,
				bookRef.oleId,
				bookRef.works,
				bookRef.bookSummary,
			]
		);
		bookId = bookKey.rows[0].id_book;
	} catch (err) {
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			bookKey = await db.query(
				"SELECT id_book FROM books WHERE book_oleid = $1",
				[bookRef.oleId]
			);
			bookId = bookKey.rows[0].id_book;
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
		console.log("Error inserting books_authors");
		const problem = categorizeSQLError(err);
		if (problem.type === "DUPLICATE") {
			console.error("Error inserting books_authors: Shows DUPLICATE");
		} else if (problem.type === "CONNECTION") {
			// maybe restart DB connection?
			console.error("Error inserting books_authors: Shows CONNECTION");
		} else {
			console.error("Error inserting books_authors");
			console.error("Unexpected SQL issue in books Authors:", problem);
			console.log("Author id:", authorId, typeof authorId);
			console.log("Book id:", bookId, typeof bookId);
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
		} else if (problem.type === "CONNECTION") {
			console.log("Connection error while inserting books_readers");
		} else {
			console.error("Error inserting books_readers:");
			console.error("Unexpected SQL issue in book_reader:", problem);
		}
	}
	return insertResult;
}
