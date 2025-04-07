$(".bookBtn").on("click", function (event) {
	event.preventDefault(); // Prevent form submission

	// Retrieve data from the button's data-* attributes
	const bookKey = $(this).data("key");
	console.log(bookKey);
	// Send data to the server using jQuery's AJAX method
	$.ajax({
		url: "/select",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ key: bookKey }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/book");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});

$(".newBlog").on("click", function (event) {
	event.preventDefault(); // Prevent form submission
	// Send data to the server using jQuery's AJAX method

	$.ajax({
		url: "/new",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ key: "new" }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/blog");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});
