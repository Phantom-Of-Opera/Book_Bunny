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

// On form submit, copy HTML into hidden input
document.querySelector("form").addEventListener("submit", function () {
	document.getElementById("bookAnalysis").value = quill.root.innerHTML;
});

document.getElementById("toggleDescription").addEventListener("click", () => {
	const description = document.getElementById("bookDescription");
	const icon = document.getElementById("descIcon");
	const text = document.getElementById("toggleText");

	const isOpen = description.classList.toggle("open");
	icon.classList.toggle("rotated");
	text.textContent = isOpen ? "Hide Description" : "Show Description";
});

// Attach event listener to the button
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

$("#btnCancel").on("click", function () {
	location.assign("/");
});

document
	.getElementById("bookAnalysisForm")
	.addEventListener("submit", function () {
		const html = quill.root.innerHTML;
		document.getElementById("bookAnalysis").value = html;
	});
