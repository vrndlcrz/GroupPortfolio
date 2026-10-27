package com.aet.portfolio.controller;

import com.aet.portfolio.model.Note;
import com.aet.portfolio.service.MemberService;
import com.aet.portfolio.service.NoteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class NoteController {

    private final NoteService noteService;
    private final MemberService memberService;

    public NoteController(NoteService noteService, MemberService memberService) {
        this.noteService = noteService;
        this.memberService = memberService;
    }

    @GetMapping("/api/members/{id}/notes")
    public ResponseEntity<?> getNotesForMember(@PathVariable int id) {
        if (memberService.getMemberById(id).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Member not found with id " + id));
        }
        List<Note> notes = noteService.getNotesForMember(id);
        return ResponseEntity.ok(notes);
    }

    @PostMapping("/api/members/{id}/notes")
    public ResponseEntity<?> addNote(@PathVariable int id, @RequestBody(required = false) Map<String, String> payload) {
        if (memberService.getMemberById(id).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Member not found with id " + id));
        }

        if (payload == null || !payload.containsKey("text")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Note text is required."));
        }

        String text = payload.get("text");
        String author = payload.getOrDefault("author", "Anonymous");

        try {
            Note created = noteService.addNote(id, text, author);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save note."));
        }
    }

    // Endpoint to retrieve all notes across all members for desk sticky notes display
    @GetMapping("/api/notes")
    public ResponseEntity<List<Note>> getAllNotes() {
        return ResponseEntity.ok(noteService.getAllNotes());
    }
}
