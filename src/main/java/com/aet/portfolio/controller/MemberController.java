package com.aet.portfolio.controller;

import com.aet.portfolio.model.Member;
import com.aet.portfolio.service.MemberService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.io.IOException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.core.io.ClassPathResource;

@RestController
@RequestMapping("/api/members")
public class MemberController {

    private final MemberService memberService;

    private final ObjectMapper mapper;
    private final Map<Integer, Map<String, String>> profileFields = new HashMap<>();

    public MemberController(MemberService memberService, ObjectMapper mapper) throws IOException {
        this.memberService = memberService;
        this.mapper = mapper;
        // Optional presentation fields augment the existing serialized member contract.
        try (var input = new ClassPathResource("data/members.json").getInputStream()) {
            for (JsonNode entry : mapper.readTree(input)) {
                Map<String, String> fields = new HashMap<>();
                for (String key : List.of("titleText", "ageLine", "objective"))
                    if (entry.hasNonNull(key)) fields.put(key, entry.get(key).asText());
                if (!fields.isEmpty()) profileFields.put(entry.get("id").asInt(), fields);
            }
        }
    }

    private Map<String, Object> withProfile(Member member) {
        Map<String, Object> result = mapper.convertValue(member, new TypeReference<>() {});
        result.putAll(profileFields.getOrDefault(((Number) result.get("id")).intValue(), Map.of()));
        return result;
    }

    @GetMapping
    public List<Map<String, Object>> getAllMembers() {
        return memberService.getAllMembers().stream().map(this::withProfile).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getMemberById(@PathVariable int id) {
        return memberService.getMemberById(id)
                .map(this::withProfile)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
