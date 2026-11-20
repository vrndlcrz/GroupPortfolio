package com.aet.portfolio.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/** Keeps writable data outside the packaged source tree. */
@Component
public class JsonFileStore {
    private final Path directory;
    private final ObjectMapper mapper;

    public JsonFileStore(ObjectMapper mapper,
                         @Value("${site.storage.directory:var/data}") String directory) throws IOException {
        this.mapper = mapper;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(this.directory);
        // Existing installations can keep their data when adopting the new layout.
        // Copy legacy files only for the default location, never over newer data.
        if (this.directory.equals(Path.of("var/data").toAbsolutePath().normalize())) {
            for (String name : new String[]{"notes.json", "counter.json"}) {
                Path legacy = Path.of(name);
                if (Files.isRegularFile(legacy) && !Files.exists(file(name))) {
                    Files.copy(legacy, file(name));
                }
            }
        }
    }

    public Path file(String name) {
        return directory.resolve(name);
    }

    /** Write a sibling temporary file before replacing the last valid JSON file. */
    public void write(String name, Object value) throws IOException {
        Path temporary = Files.createTempFile(directory, name + ".", ".tmp");
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), value);
            try {
                Files.move(temporary, file(name), StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temporary, file(name), StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }
}
