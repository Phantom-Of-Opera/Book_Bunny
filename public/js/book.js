const toggleBtn = document.getElementById("toggleDescription");
const description = document.getElementById("bookDescription");
const icon = document.getElementById("descIcon");

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

// Set initial content (escaped HTML from your server)
// const initialContent = `<%- locals.setBlogText %>`;
// quill.root.innerHTML = initialContent;

// On form submit, copy HTML into hidden input
document.querySelector("form").addEventListener("submit", function () {
	document.getElementById("bookAnalysis").value = quill.root.innerHTML;
});

toggleBtn.addEventListener("click", () => {
	description.classList.toggle("open");
	icon.classList.toggle("rotated");
});

// Attach event listener to the button
$("#btnDelete").on("click", function () {
	// Show an alert for confirmation
	if (confirm("Are you sure you want to delete this book and you summaries?")) {
		const blookKey = $("#titleID").val() + "|" + $("#authorID").val();
		// Send POST request to /delete route
		$.ajax({
			url: "/delete", // Server endpoint
			type: "POST", // HTTP method
			contentType: "application/json", // Sending JSON data
			data: JSON.stringify({ key: blogKey }), // Optional data
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

$("#btnCancel").on("click", function () {
	location.assign("/");
});
