import express from "express";
import bodyParser from "body-parser";
import * as fs from "node:fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const fileBlogs = "./public/files/blogs.json";
var selectBlog = null;

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
	});
});

app.get("/blog", (req, res) => {
	res.render("blog.ejs", {
		page: "blog",
		setAuthor: selectBlog[0].blogAuthor,
		setTitle: selectBlog[0].blogTitle,
		setBlogText: selectBlog[0].blogText,
	});
});

app.post("/select", (req, res) => {
	selectBlog = selectFromFile(req.body.key);
	res.send("OK");
});

app.post("/new", (req, res) => {
	selectBlog = [
		{
			blogAuthor: "Your name",
			blogTitle: "Title of your blog",
			blogText: "Your blog text",
		},
	];
	res.send("OK");
});

app.post("/submit", (req, res) => {
	var newBlog = {
		blogAuthor: req.body.author,
		blogTitle: req.body.title,
		blogText: req.body.blogText,
		blogKey: req.body.title + "|" + req.body.author,
		blogDate: new Date(),
	};

	addToFile(newBlog);
	res.redirect("/");
});

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
