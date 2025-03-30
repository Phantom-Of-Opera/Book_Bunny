import express from "express";
import bodyParser from "body-parser";
import * as fs from "node:fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import axios from "axios";

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

const fileBlogs = "./public/files/blogs.json";

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

app.get("/", (req, res) => {
	res.render("home.ejs", {
		page: "home",
		blogList: getFromFile(),
		userName: selectedName,
		userIcon: selectedIcon,
	});
});

app.get("/user", async (req, res) => {
	const resultUser = await db.query("SELECT * FROM readers");
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
	try {
		let searchString = new URLSearchParams({
			title: req.body.searchTitle,
		});
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
	var newAuthor_key = null;

	bookSelection.forEach(async (book) => {
		// Start by inserting the book info into the database
		try {
			newBook_id = await db.query(
				"INSERT INTO books (book_title, book_cover_id, book_first_publish, book_oleid) VALUES ($1, $2, $3, $4) RETURNING id_book",
				[book.title, book.cover, book.publish, book.oleId]
			);

			// Now, insert the book's authors into the book_authors table
			book.author_key.forEach(async (author) => {
				try {
					newAuthor_key = await db.query(
						"INSERT INTO authors (author_key) VALUES ($1) RETURNING id_author",
						[author]
					);
					//get the rest of the information from the API
					try {
						const authorURL = `https://openlibrary.org/authors/${author}.json`;
						const authorData = await axios.get(authorURL);
						var authorName = authorData.data.name;
						var authorWork = authorData.data.top_work;
						var authorBirth = parseDateString(authorData.data.birth_date);
						var authorDeath = parseDateString(authorData.data.death_date);
						var authorWiki = authorData.data.remote_ids["wikidata"];
					} catch (error) {
						console.error("Error fetching author data:", error);
						authorName = null;
						authorWork = null;
						authorBirth = null;
						authorDeath = null;
						authorWiki = null;
					}
					// Insert the author into the authors table
					try {
						await db.query(
							"UPDATE authors SET author_name = $1, author_top_work = $2, author_birth_date = $3, author_death_date = $4, author_wikidata = $5 WHERE id_author = $6",
							[
								authorName,
								authorWork,
								authorBirth,
								authorDeath,
								authorWiki,
								newAuthor_key.rows[0].id_author,
							]
						);
					} catch (error) {
						console.error("Error updating author:", error);
					}
					// Insert the relationship into the book_authors table
					try {
						await db.query(
							"INSERT INTO books_authors (id_book, id_author) VALUES ($1, $2)",
							[newBook_id.rows[0].id_book, newAuthor_key.rows[0].id_author]
						);
					} catch (error) {
						console.error("Error inserting books_authors:", error);
					}
				} catch (error) {
					console.error("Error inserting author:", error);
				}
			});
			//Insert the relationship into the books_readers table
			try {
				await db.query(
					"INSERT INTO books_readers (id_book, id_reader) VALUES ($1, $2)",
					[newBook_id.rows[0].id_book, selectedUser]
				);
			} catch (error) {
				console.error("Error inserting books_readers:", error);
			}
		} catch (error) {
			console.error("Error inserting book:", error);
		}
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

function addToFile(newBlog) {
	let blogsArray = getFromFile();
	blogsArray.push(newBlog);
	fs.writeFileSync(fileBlogs, JSON.stringify(blogsArray, null, 2), "utf8");
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

function selectFromFile(delBlogKey) {
	let blogsArray = getFromFile();
	if (blogsArray.length !== 0) {
		return (blogsArray = blogsArray.filter(
			(blogsArray) => blogsArray.blogKey == delBlogKey
		));
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
