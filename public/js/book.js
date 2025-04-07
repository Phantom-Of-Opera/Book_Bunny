// Attach event listener to the button
$("#btnDelete").on("click", function () {
	// Show an alert for confirmation
	if (confirm("Are you sure you want to delete?")) {
		const blogKey = $("#titleID").val() + "|" + $("#authorID").val();
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
