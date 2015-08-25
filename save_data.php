<?php
// From Josh de Leeuw.
// The $_POST[] array will contain the passed in filename and data.
// The directory "data" is writable by the server (chmod 777).
$filename = "data/".$_POST['filename'];
$data = $_POST['filedata'];
// write the file to disk
file_put_contents($filename, $data);
?>
