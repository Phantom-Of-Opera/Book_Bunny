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

	// console.log("Book list:", bookList);
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
	var newBook_key = null;
	var newBook_id = null;
	var newAuthor_key = null;
	var newAuthor_id = null;

	bookSelection.forEach(async (book) => {
		// Start by inserting the book info into the database
		try {
			newBook_key = await db.query(
				"INSERT INTO books (book_title, book_cover_id, book_first_publish, book_oleid) VALUES ($1, $2, $3, $4) RETURNING id_book",
				[book.title, book.cover, book.publish, book.oleId]
			);
			newBook_id = newBook_key.rows[0].id_book;
			console.log("Inserted book:", book.title);
			// Now, insert the book's authors into the book_authors table
			console.log("Book authors:", book.author_key);
			book.author_key.forEach(async (author) => {
				try {
					console.log("Trying to insert author:", author);

					newAuthor_key = await db.query(
						"INSERT INTO authors (author_key) VALUES ($1) RETURNING id_author",
						[author]
					);
					newAuthor_id = newAuthor_key.rows[0].id_author;

					console.log(
						"Successfully insert author:",
						author,
						"with author_id:",
						newAuthor_id
					);

					//get the rest of the information from the API
					try {
						console.log(
							"Trying to get author data from OpenLibrary for author:",
							author
						);
						const authorURL = `https://openlibrary.org/authors/${author}.json`;
						const authorData = await axios.get(authorURL);
						var authorName = authorData.data.name;
						var authorWork = authorData.data.top_work;
						var authorBirth = parseDateString(authorData.data.birth_date);
						var authorDeath = parseDateString(authorData.data.death_date);
						var authorWiki = "wikidata"; //authorData.data.remote_ids["wikidata"];
						console.log(
							"Successfully got the author information for ",
							authorName
						);
					} catch (err) {
						// If the author data is not available, set default values
						console.error("Error fetching author data for author:", author);
						console.error("Error:", err);
						// Set default values
						authorName = "Unknown Author";
						authorWork = null;
						authorBirth = null;
						authorDeath = null;
						authorWiki = null;
					}
					// Insert the author into the authors table
					try {
						console.log(
							"Trying to update the author info into authors table for author:",
							authorName
						);

						await db.query(
							"UPDATE authors SET author_name = $1, author_top_work = $2, author_birth_date = $3, author_death_date = $4, author_wikidata = $5 WHERE id_author = $6",
							[
								authorName,
								authorWork,
								authorBirth,
								authorDeath,
								authorWiki,
								newAuthor_id,
							]
						);
					} catch (err) {
						console.error(
							"Error updating author information for author:",
							authorName
						);
						const problem = categorizeSQLError(err);
						if (problem.type === "DUPLICATE") {
							// skip
						} else if (problem.type === "CONNECTION") {
							// maybe restart DB connection?
						} else {
							console.error("Error updating author");
							console.error("Unexpected SQL issue:", problem);
						}
					}
				} catch (err) {
					console.log("Failed insert author:", author);
					console.log("Current author_id:", newAuthor_id);
					const problem = categorizeSQLError(err);
					if (problem.type === "DUPLICATE") {
						console.log("Author already exists in the database: ", author);
						// Get the newAuthor_id of the author that already exist in the db
						console.log(
							"Trying to get the newAuthor_id for existing author:",
							author
						);
						newAuthor_id = await db.query(
							"SELECT id_author FROM authors WHERE author_key = $1",
							[author]
						);
						console.log("Fetched the newAuthor_id:", newAuthor_id);
					} else if (problem.type === "CONNECTION") {
						// maybe restart DB connection?
						console.log("Connection error while inserting author:", author);
					} else {
						console.error("Unexpected SQL issue:", problem);
					}
				}

				console.log(
					"Trying to insert into books_authors table for book:",
					book.title
				);
				console.log(
					"Trying to insert into books_authors table for author:",
					author
				);
				console.log("newBook_id:", newBook_id);
				console.log("newAuthor_id:", newAuthor_id);

				// Insert the relationship into the book_authors table
				try {
					await db.query(
						"INSERT INTO books_authors (id_book, id_author) VALUES ($1, $2)",
						[newBook_id, newAuthor_id]
					);
				} catch (err) {
					console.error("Error inserting books_authors");
					console.log("Information at time of error:");
					console.log(
						"newBook_id: " + newBook_id + "newAuthor_id: " + newAuthor_id
					);
					const problem = categorizeSQLError(err);
					if (problem.type === "DUPLICATE") {
						console.error("Error inserting books_authors: Shows DUPLICATE");
					} else if (problem.type === "CONNECTION") {
						// maybe restart DB connection?
						console.error("Error inserting books_authors: Shows CONNECTION");
					} else {
						console.error("Error inserting books_authors");
						console.error("Unexpected SQL issue:", problem);
					}
				}
			});
			//Insert the relationship into the books_readers table
			try {
				await db.query(
					"INSERT INTO books_readers (id_book, id_reader) VALUES ($1, $2)",
					[newBook_id, selectedUser]
				);
			} catch (err) {
				const problem = categorizeSQLError(err);
				if (problem.type === "DUPLICATE") {
					// skip
				} else if (problem.type === "CONNECTION") {
					// maybe restart DB connection?
				} else {
					console.error("Error inserting books_readersr");
					console.error("Unexpected SQL issue:", problem);
				}
			}
		} catch (err) {
			const problem = categorizeSQLError(err);
			if (problem.type === "DUPLICATE") {
				newBook_key = await db.query(
					"SELECT id_book FROM books WHERE book_oleid = $1",
					[book.oleId]
				);
				newBook_id = newBook_key.rows[0].id_book;
			} else if (problem.type === "CONNECTION") {
				// maybe restart DB connection?
			} else {
				console.error("Error inserting book");
				console.error("Unexpected SQL issue:", problem);
			}
		}
		//Insert the relationship into the books_readers table
		try {
			await db.query(
				"INSERT INTO books_readers (id_book, id_reader) VALUES ($1, $2)",
				[newBook_id, selectedUser]
			);
		} catch (err) {
			const problem = categorizeSQLError(err);
			if (problem.type === "DUPLICATE") {
				// skip
			} else if (problem.type === "CONNECTION") {
				// maybe restart DB connection?
			} else {
				console.error("Error inserting books_readers:");
				console.error("Unexpected SQL issue:", problem);
			}
		}
	});
	res.render("newBook.ejs", {
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

// app.post("/select", (req, res) => {
// 	selectBlog = selectFromFile(req.body.key);
// });

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

function getFromFile() {
	let blogsArray = [];
	try {
		blogsArray = JSON.parse(fs.readFileSync(fileBlogs, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") {
			console.warn("File not found, using default data.");
			blogsArray = [];
		} else {
			throw error;
		}
	}
	return blogsArray;
}

async function getFromDatabase(idReader) {
	try {
		let result = null;
		if (idReader == null) {
			result = await db.query("SELECT * FROM book_author_view");
		} else {
			result = await db.query("SELECT * FROM get_reader_books($1)", [idReader]);
		}
		return result.rows;
	} catch (err) {
		console.error("Error executing query", err.stack);
		return null;
	}
}

function removeFromFile(delBlogKey) {
	let blogsArray = getFromFile();
	if (blogsArray.length !== 0) {
		blogsArray = blogsArray.filter(
			(blogsArray) => blogsArray.blogKey !== delBlogKey
		);
		fs.writeFileSync(fileBlogs, JSON.stringify(blogsArray, null, 2), "utf8");
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
