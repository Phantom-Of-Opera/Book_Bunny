//Opent the details of the selected book

$(".moreBtn").on("click", function (event) {
	event.preventDefault(); // Prevent form submission

	// Retrieve data from the button's data-* attributes
	const authorId = $(this).data("key");
	// Send data to the server using jQuery's AJAX method
	$.ajax({
		url: "/more",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ key: authorId }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/thisAuthor");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});

// Filter authors based on the search input
function filterAuthors() {
	const searchInput = document.getElementById("filterBar").value.toLowerCase();
	const cards = document.querySelectorAll(".card-body");
	cards.forEach((card) => {
		const author = card.querySelector(".card-title").textContent.toLowerCase();
		if (author.includes(searchInput)) {
			card.parentElement.style.display = "block";
			// card.classList.remove("hidden");
		} else {
			// card.classList.add("hidden");
			card.parentElement.style.display = "none";
		}
	});
}
