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
	const initialFromServer = "<%- thisAuthor.author_notes%>";
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

//Star rating functionality
const stars = document.querySelectorAll(".star-rating.interactive i");
const ratingInput = document.getElementById("author_rating");

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
	document.getElementById("authorRating").value = rating;
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

//FIXME: This function is not working. The one in books is working but the authors are not.
function saveData() {
	// Send POST request to /save route
	if (!$("userId").val()) {
		$.ajax({
			url: "/saveAuthor", // Server endpoint
			type: "POST", // HTTP method
			contentType: "application/json", // Sending JSON data
			data: JSON.stringify({
				authorId: $("#authorId").val(),
				userId: $("#userId").val(),
				authorNotes: quill.root.innerHTML,
				authorRating: $("#authorRating").val(),
				authorGenre: "no genre yet", // $("#bookCollectionSelect").val(),
			}),

			// Optional data
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
}
