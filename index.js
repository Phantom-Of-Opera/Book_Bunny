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

// app.get("/blog", (req, res) => {
// 	res.render("blog.ejs", {
// 		page: "blog",
// 		setAuthor: selectBlog[0].blogAuthor,
// 		setTitle: selectBlog[0].blogTitle,
// 		setBlogText: selectBlog[0].blogText,
// 	});
// });

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
	console.log(req.body);
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
});

app.post("/tab", (req, res) => {
	console.log(req.body);
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

app.post("/search", async (req, res) => {
	try {
		console.log(req.body);

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
