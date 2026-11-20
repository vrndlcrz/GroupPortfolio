package com.aet.portfolio;

import com.aet.portfolio.controller.VisitController;
import com.aet.portfolio.service.CounterService;
import com.aet.portfolio.service.NoteService;
import com.aet.portfolio.storage.JsonFileStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StorageFailureTest {
    @TempDir Path temporary;

    @Test void noteWriteFailureDoesNotPublishAnUnsavedNote() throws Exception {
        JsonFileStore store = mock(JsonFileStore.class);
        doThrow(new IOException("disk full")).when(store).write(eq("notes.json"), any());
        NoteService notes = new NoteService(new ObjectMapper(), store);
        assertThatThrownBy(() -> notes.addNote(1, "Hello", "Tester")).isInstanceOf(RuntimeException.class);
        assertThat(notes.getAllNotes()).isEmpty();
    }

    @Test void failedCounterWriteReturnsAnErrorWithoutIncrementingMemory() throws Exception {
        JsonFileStore store = mock(JsonFileStore.class);
        doThrow(new IOException("disk full")).when(store).write(eq("counter.json"), any());
        CounterService counter = new CounterService(new ObjectMapper(), store);
        var response = new VisitController(counter).recordVisit();
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(counter.getCount()).isZero();
        assertThat(response.getBody()).containsKey("error");
    }

    @Test void serializationFailureKeepsThePreviousFileAndRemovesTemporaryFiles() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonFileStore store = new JsonFileStore(mapper, temporary.toString());
        store.write("counter.json", Map.of("count", 7));
        Object broken = new Object() {
            public int getValue() { throw new IllegalStateException("cannot serialize"); }
        };
        assertThatThrownBy(() -> store.write("counter.json", broken)).isInstanceOf(IOException.class);
        assertThat(mapper.readTree(store.file("counter.json").toFile()).get("count").asInt()).isEqualTo(7);
        try (var files = Files.list(temporary)) {
            assertThat(files.map(p -> p.getFileName().toString()).toList()).containsExactly("counter.json");
        }
    }
}
