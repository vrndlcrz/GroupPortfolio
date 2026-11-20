package com.aet.portfolio.service;

import com.aet.portfolio.model.Note;
import com.aet.portfolio.storage.JsonFileStore;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class NoteService {

    private static final Logger logger = LoggerFactory.getLogger(NoteService.class);
    private static final String NOTES_FILE = "notes.json";
    private final ObjectMapper objectMapper;
    private final JsonFileStore store;
    private final Object fileLock = new Object();
    private final List<Note> notesCache = new ArrayList<>();

    public NoteService(ObjectMapper objectMapper, JsonFileStore store) {
        this.objectMapper = objectMapper;
        this.store = store;
    }

    @PostConstruct
    public void init() {
        synchronized (fileLock) {
            File file = store.file(NOTES_FILE).toFile();
            if (!file.exists()) {
                try {
                    store.write(NOTES_FILE, new ArrayList<Note>());
                    logger.info("Initialized empty notes.json at {}", file.getAbsolutePath());
                } catch (IOException e) {
                    logger.error("Could not create notes.json", e);
                }
            } else {
                try {
                    List<Note> loaded = objectMapper.readValue(file, new TypeReference<List<Note>>() {});
                    if (loaded != null) {
                        notesCache.addAll(loaded);
                    }
                    logger.info("Loaded {} existing notes from notes.json", notesCache.size());
                } catch (IOException e) {
                    logger.error("Error reading existing notes.json, initializing empty cache", e);
                }
            }
        }
    }

    public List<Note> getNotesForMember(int memberId) {
        synchronized (fileLock) {
            return notesCache.stream()
                    .filter(n -> n.getMemberId() == memberId)
                    .collect(Collectors.toList());
        }
    }

    public List<Note> getAllNotes() {
        synchronized (fileLock) {
            return new ArrayList<>(notesCache);
        }
    }

    public Note addNote(int memberId, String rawText, String rawAuthor) {
        if (rawText == null) {
            throw new IllegalArgumentException("Note text cannot be null.");
        }
        String trimmedText = rawText.trim();
        if (trimmedText.isEmpty()) {
            throw new IllegalArgumentException("Note text cannot be empty.");
        }
        if (trimmedText.length() > 120) {
            throw new IllegalArgumentException("Note text exceeds maximum length of 120 characters.");
        }

        // Sanitize to prevent XSS / script injection
        String safeText = HtmlUtils.htmlEscape(trimmedText);

        String safeAuthor = "Anonymous";
        if (rawAuthor != null && !rawAuthor.trim().isEmpty()) {
            String trimmedAuthor = rawAuthor.trim();
            if (trimmedAuthor.length() > 40) {
                trimmedAuthor = trimmedAuthor.substring(0, 40);
            }
            safeAuthor = HtmlUtils.htmlEscape(trimmedAuthor);
        }

        Note note = new Note(
                UUID.randomUUID().toString(),
                memberId,
                safeText,
                safeAuthor,
                Instant.now().toEpochMilli()
        );

        synchronized (fileLock) {
            try {
                List<Note> updated = new ArrayList<>(notesCache);
                updated.add(note);
                store.write(NOTES_FILE, updated);
                notesCache.add(note);
            } catch (IOException e) {
                logger.error("Failed to persist note to notes.json", e);
                throw new RuntimeException("Could not persist note", e);
            }
        }

        return note;
    }
}
