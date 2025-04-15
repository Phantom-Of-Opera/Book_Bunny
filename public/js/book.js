// Initialize Quill
const quill = new Quill("#quillEditor", {
	theme: "snow",
	placeholder: "Write your bunny-powered analysis here...",
	modules: {
		toolbar: [
			["bold", "italic", "underline"],
			[{ list: "ordered" }, { list: "bullet" }],
			["link", "clean"],
		],
	},
});

//Does the autosave of quill on localstorage

// Define a unique key for this book/page/user
const storageKey = "autosave_bookAnalysis";
// 🔁 Load existing saved content
const saved = localStorage.getItem(storageKey);

if (saved) {
	quill.root.innerHTML = saved;
} else {
	const initialFromServer = "<%- thisBook.book_notes%>";
	localStorage.setItem(storageKey, initialFromServer);
}

// 💾 Save on change (debounced)
let timeout = null;
quill.on("text-change", () => {
	clearTimeout(timeout);
	timeout = setTimeout(() => {
		const html = quill.root.innerHTML;
		localStorage.setItem(storageKey, html);
		console.log("Autosaved");
	}, 1000); // 1 second debounce
});

//Trigger a save to the database when leaving the page
window.addEventListener("beforeunload", () => {
	saveData();
	//emply localStorage
	localStorage.removeItem(storageKey);
});

//Toggle description
document.getElementById("toggleDescription").addEventListener("click", () => {
	const description = document.getElementById("bookDescription");
	const icon = document.getElementById("descIcon");
	const text = document.getElementById("toggleText");

	const isOpen = description.classList.toggle("open");
	icon.classList.toggle("rotated");
	text.textContent = isOpen ? "Hide Description" : "Show Description";
});

//Save the data
$("#btnSave").on("click", function () {
	saveData();
});

// Attach event listener to the delete button
$("#btnDelete").on("click", function () {
	// Show an alert for confirmation
	if (confirm("Are you sure you want to delete this book and you summaries?")) {
		const bookId = $("#bookId").val();
		const userId = $("#userId").val();
		// Send POST request to /delete route
		$.ajax({
			url: "/delete", // Server endpoint
			type: "POST", // HTTP method
			contentType: "application/json", // Sending JSON data
			data: JSON.stringify({ bookId: bookId, userId: userId }), // Optional data
			success: function (response) {
				console.log("Delete successful:", response);
				alert("Delete was successful!");
				// Optionally redirect or update UI
				location.assign("/"); // Redirect after deletion
			},
			error: function (xhr, status, error) {
				console.error("Delete failed:", error);
			},
		});
	}
});

//Star rating functionality
const stars = document.querySelectorAll(".star-rating.interactive i");
const ratingInput = document.getElementById("book_rating");

function updateStars(rating) {
	stars.forEach((star, index) => {
		if (index < rating) {
			star.classList.add("bi-star-fill");
			star.classList.remove("bi-star");
		} else {
			star.classList.add("bi-star");
			star.classList.remove("bi-star-fill");
		}
	});
	document.getElementById("bookRating").value = rating;
}

stars.forEach((star) => {
	star.addEventListener("click", function () {
		const selectedRating = parseInt(this.getAttribute("data-value"));
		ratingInput.value = selectedRating;
		updateStars(selectedRating);
	});
});

// Initialize from the input's current value
updateStars(parseInt(ratingInput.value));

//-----------------------------------------
//--------------- Functions ---------------
//-----------------------------------------

function saveData() {
	//Send POST request to /save route
	$.ajax({
		url: "/save", // Server endpoint
		type: "POST", // HTTP method
		contentType: "application/json", // Sending JSON data
		data: JSON.stringify({
			bookId: $("#bookId").val(),
			userId: $("#userId").val(),
			bookAnalysis: quill.root.innerHTML,
			bookStructure: "No structuer yet",
			bookRating: $("#bookRating").val(),
			bookCollection: $("#bookCollectionSelect").val(),
		}), // Optional data
		success: function (response) {
			localStorage.removeItem(storageKey);
			console.log("Save successful:", response);
			alert("Save was successful!");
		},
		error: function (xhr, status, error) {
			console.error("Save failed:", error);
			alert("Save failed. Please try again.");
		},
	});
}
